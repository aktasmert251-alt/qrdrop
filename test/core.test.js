/* Çekirdek testleri: node test/core.test.js */
'use strict';
const crypto = require('crypto');
const Q = require('../app/core.js');
const qrcode = require('../app/vendor/qrcode.js');
const jsQR = require('../app/vendor/jsQR.js');

let fails = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
  if (!cond) fails++;
};
const same = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

// Base45
let b45ok = true;
for (let n = 0; n < 60; n++) {
  const r = crypto.randomBytes(n);
  const s = Q.b45enc(r);
  if (!/^[0-9A-Z $%*+\-./:]*$/.test(s) || !same(Q.b45dec(s), r)) b45ok = false;
}
ok('Base45 gidiş-dönüş (0–59 bayt)', b45ok);
ok('Base45 bozuk girişi reddeder', Q.b45dec('abc') === null && Q.b45dec('GGW') === null && Q.b45dec('A') === null);

// Paket
const body = crypto.randomBytes(1234);
const u = Q.unpack(Q.pack('Fotoğraf ışık çiçek.jpg', 'image/jpeg', body));
ok('Paket: Türkçe ad, tür, içerik korunur', u.name === 'Fotoğraf ışık çiçek.jpg' && u.mime === 'image/jpeg' && same(u.bytes, body));

// LT: kayıplı kanal
function run(size, B, drop, skipFirst, seed) {
  const data = crypto.randomBytes(size);
  const enc = new Q.Encoder(data, B, seed);
  const dec = new Q.Decoder();
  let sent = 0;
  let r;
  if (skipFirst) enc.seed = enc.K;
  for (;;) {
    const f = enc.next();
    sent++;
    if (Math.random() < drop) continue;
    r = dec.add(f);
    if (r.status === 'done' || sent > enc.K * 30 + 200) break;
  }
  return { ok: r.status === 'done' && same(r.data, data), K: enc.K, sent, over: sent / enc.K };
}
for (const [size, B, drop, skip] of [[3, 520, 0, false], [600, 520, 0.3, false], [5000, 280, 0, false], [40000, 520, 0.3, false],
  [40000, 520, 0.6, false], [200000, 800, 0.4, false], [200000, 800, 0, true], [900000, 800, 0.25, false]]) {
  const r = run(size, B, drop, skip, (Math.random() * 2 ** 32) >>> 0);
  ok(`LT ${size} B, parça ${B}, kayıp %${drop * 100}${skip ? ', ilk turu kaçırdı' : ''}`, r.ok,
    `K=${r.K}, gönderilen ${r.sent} kare (${r.over.toFixed(2)}× / kayıpsız eşdeğer ${(r.over * (1 - drop)).toFixed(2)}×)`);
}

// Başka QR'lar ve aktarım değişimi
const dec = new Q.Decoder();
ok('Yabancı QR yok sayılır', dec.add('https://example.com').status === 'foreign' && dec.add('HELLO WORLD').status === 'foreign');
const e1 = new Q.Encoder(crypto.randomBytes(3000), 280, 1);
const e2data = crypto.randomBytes(2000);
const e2 = new Q.Encoder(e2data, 280, 2);
dec.add(e1.next()); dec.add(e1.next());
let st = dec.add(e2.next()).status;
ok('Yeni aktarım algılanınca baştan başlar', st === 'restart');
let r;
while ((r = dec.add(e2.next())).status !== 'done');
ok('Yeni aktarım tamamlanır', same(r.data, e2data));

// Bozuk veri: CRC yakalar
const bad = new Q.Encoder(crypto.randomBytes(1000), 280, 9);
const d2 = new Q.Decoder();
const frames = [bad.next(), bad.next(), bad.next(), bad.next()];
const raw = Q.b45dec(frames[1]); raw[Q.HEAD + 5] ^= 0xFF;
frames[1] = Q.b45enc(raw);
let last;
for (const f of frames) last = d2.add(f).status;
ok('Bozulmuş parça CRC ile yakalanır', last === 'corrupt');

// Gerçek QR: üret → piksele çiz → jsQR ile oku → çöz
function qrImage(text, scale) {
  const q = qrcode(0, 'L');
  q.addData(text, 'Alphanumeric');
  q.make();
  const n = q.getModuleCount(), pad = 4, size = (n + pad * 2) * scale;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!q.isDark(r, c)) continue;
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      const i = (((r + pad) * scale + y) * size + (c + pad) * scale + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }
  return { px, size, version: (n - 17) / 4 };
}
for (const B of [280, 520, 800]) {
  const data = Q.pack('test.bin', 'application/octet-stream', crypto.randomBytes(B * 3));
  const enc = new Q.Encoder(data, B, 77);
  const d = new Q.Decoder();
  let res, version, n = 0, t = 0;
  while (n++ < 60) {
    const img = qrImage(enc.next(), 3);
    version = img.version;
    const t0 = process.hrtime.bigint();
    const got = jsQR(img.px, img.size, img.size, { inversionAttempts: 'dontInvert' });
    t += Number(process.hrtime.bigint() - t0) / 1e6;
    if (!got) continue;
    res = d.add(got.data);
    if (res.status === 'done') break;
  }
  const u2 = res && res.status === 'done' && Q.unpack(res.data);
  ok(`Gerçek QR okuma, parça ${B} B (QR sürüm ${version})`, !!u2 && u2.name === 'test.bin', `${n} kare, okuma başına ${(t / n).toFixed(1)} ms`);
}

console.log(fails ? `\n${fails} test başarısız` : '\nTüm testler geçti');
process.exit(fails ? 1 : 0);
