/* QR Aktar çekirdeği: Base45, CRC32, paketleme ve LT (fountain) kodlama.
   Tarayıcıda window.QRA, Node'da require() ile kullanılır.

   Kare biçimi (bayt), Base45 ile QR "alfanümerik" kipine yazılır:
     0      0x51 (sürüm işareti)
     1..4   aktarım kimliği
     5..6   parça sayısı K
     7..10  toplam veri uzunluğu
     11..14 verinin CRC32'si
     15..18 tohum (seed): < K ise doğrudan o parça, değilse parçaların XOR karışımı
     19..   parça verisi (B bayt)
   Alıcı hangi kareleri kaçırırsa kaçırsın, yeterince kare gördüğünde dosyayı çözer. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QRA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const MAGIC = 0x51;
const HEAD = 19;
const MAX_K = 65535;

/* ---------- Base45 (RFC 9285): QR alfanümerik kipinin harf kümesi ---------- */
const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const B45MAP = new Int16Array(128).fill(-1);
for (let i = 0; i < 45; i++) B45MAP[B45.charCodeAt(i)] = i;

function b45enc(bytes) {
  const out = [];
  let i = 0;
  for (; i + 1 < bytes.length; i += 2) {
    let n = bytes[i] * 256 + bytes[i + 1];
    const c = n % 45; n = (n - c) / 45;
    const d = n % 45; const e = (n - d) / 45;
    out.push(B45[c], B45[d], B45[e]);
  }
  if (i < bytes.length) {
    const n = bytes[i];
    out.push(B45[n % 45], B45[(n - (n % 45)) / 45]);
  }
  return out.join('');
}
function b45dec(s) {
  const len = s.length;
  if (len % 3 === 1) return null;
  const out = new Uint8Array(Math.floor(len / 3) * 2 + (len % 3 === 2 ? 1 : 0));
  let o = 0;
  const v = k => { const c = s.charCodeAt(k); return c < 128 ? B45MAP[c] : -1; };
  for (let i = 0; i < len; i += 3) {
    const a = v(i), b = v(i + 1);
    if (a < 0 || b < 0) return null;
    if (i + 2 < len) {
      const c = v(i + 2);
      if (c < 0) return null;
      const n = a + b * 45 + c * 2025;
      if (n > 65535) return null;
      out[o++] = n >> 8; out[o++] = n & 255;
    } else {
      const n = a + b * 45;
      if (n > 255) return null;
      out[o++] = n;
    }
  }
  return out;
}

/* ---------- CRC32 ---------- */
const CRC_T = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC_T[n] = c >>> 0;
}
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_T[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- dosya adı + tür + içerik tek pakette ---------- */
function pack(name, mime, bytes) {
  const enc = new TextEncoder();
  const n = enc.encode(String(name)).subarray(0, 400);
  const m = enc.encode(String(mime)).subarray(0, 120);
  const out = new Uint8Array(2 + n.length + 1 + m.length + bytes.length);
  out[0] = n.length >> 8; out[1] = n.length & 255;
  out.set(n, 2);
  let o = 2 + n.length;
  out[o++] = m.length;
  out.set(m, o); o += m.length;
  out.set(bytes, o);
  return out;
}
function unpack(buf) {
  if (!buf || buf.length < 3) return null;
  const nl = (buf[0] << 8) | buf[1];
  if (2 + nl + 1 > buf.length) return null;
  const dec = new TextDecoder();
  const name = dec.decode(buf.subarray(2, 2 + nl));
  let o = 2 + nl;
  const ml = buf[o++];
  if (o + ml > buf.length) return null;
  const mime = dec.decode(buf.subarray(o, o + ml));
  o += ml;
  return { name, mime, bytes: buf.subarray(o) };
}

/* ---------- LT kodlama ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Sağlam soliton dağılımı (robust soliton), birikimli olarak.
function solitonCdf(K) {
  const cdf = new Float64Array(K + 1);
  if (K === 1) { cdf[1] = 1; return cdf; }
  const c = 0.08, delta = 0.5;
  const R = Math.max(1, c * Math.log(K / delta) * Math.sqrt(K));
  const pivot = Math.max(1, Math.min(K, Math.floor(K / R)));
  const w = new Float64Array(K + 1);
  w[1] = 1 / K;
  for (let d = 2; d <= K; d++) w[d] = 1 / (d * (d - 1));
  for (let d = 1; d < pivot; d++) w[d] += R / (d * K);
  w[pivot] += Math.max(0, R * Math.log(R / delta) / K);
  let z = 0;
  for (let d = 1; d <= K; d++) z += w[d];
  let acc = 0;
  for (let d = 1; d <= K; d++) { acc += w[d] / z; cdf[d] = acc; }
  cdf[K] = 1;
  return cdf;
}
function indices(seed, K, cdf) {
  if (seed < K) return [seed];
  const r = rng(Math.imul(seed, 2654435761) ^ (K * 40503));
  const u = r();
  let lo = 1, hi = K;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] >= u) hi = mid; else lo = mid + 1; }
  const d = lo;
  if (d === K) return Array.from({ length: K }, (_, i) => i);
  const set = new Set();
  while (set.size < d) set.add(Math.floor(r() * K));
  return Array.from(set);
}
function xorInto(dst, src) {
  for (let i = 0; i < dst.length; i++) dst[i] ^= src[i];
}

class Encoder {
  constructor(data, blockSize, id) {
    this.B = blockSize;
    this.K = Math.max(1, Math.ceil(data.length / blockSize));
    if (this.K > MAX_K) throw new RangeError('Dosya bu yoğunluk için çok büyük');
    this.total = data.length;
    this.id = id >>> 0;
    this.crc = crc32(data);
    this.blocks = [];
    for (let k = 0; k < this.K; k++) {
      const b = new Uint8Array(blockSize);
      b.set(data.subarray(k * blockSize, (k + 1) * blockSize));
      this.blocks.push(b);
    }
    this.cdf = solitonCdf(this.K);
    this.seed = 0;
  }
  frame(seed) {
    const out = new Uint8Array(HEAD + this.B);
    const dv = new DataView(out.buffer);
    out[0] = MAGIC;
    dv.setUint32(1, this.id);
    dv.setUint16(5, this.K);
    dv.setUint32(7, this.total);
    dv.setUint32(11, this.crc);
    dv.setUint32(15, seed >>> 0);
    const body = out.subarray(HEAD);
    const idx = indices(seed >>> 0, this.K, this.cdf);
    body.set(this.blocks[idx[0]]);
    for (let i = 1; i < idx.length; i++) xorInto(body, this.blocks[idx[i]]);
    return b45enc(out);
  }
  // İlk K kare parçaların kendisidir; sonrası karışım. Alıcı geç başlasa da tamamlar.
  next() { return this.frame(this.seed++); }
}

class Decoder {
  constructor() { this.reset(); }
  reset() {
    this.id = null; this.K = 0; this.B = 0; this.total = 0; this.crc = 0;
    this.blocks = null; this.byBlock = null; this.known = 0;
    this.seen = new Set(); this.frames = 0; this.done = false; this.cdf = null;
  }
  start(id, K, B, total, crc) {
    this.reset();
    this.id = id; this.K = K; this.B = B; this.total = total; this.crc = crc;
    this.blocks = new Array(K).fill(null);
    this.byBlock = new Array(K).fill(null);
    this.cdf = solitonCdf(K);
  }
  info() {
    return { id: this.id, K: this.K, B: this.B, total: this.total, known: this.known, frames: this.frames, done: this.done };
  }
  add(text) {
    const buf = typeof text === 'string' ? b45dec(text) : null;
    if (!buf || buf.length <= HEAD || buf[0] !== MAGIC) return { status: 'foreign' };
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const id = dv.getUint32(1), K = dv.getUint16(5), total = dv.getUint32(7), crc = dv.getUint32(11), seed = dv.getUint32(15);
    const B = buf.length - HEAD;
    if (!K || total > K * B || total <= (K - 1) * B) return { status: 'foreign' };
    let status = 'ok';
    if (this.id !== id || this.K !== K || this.B !== B || this.crc !== crc) {
      status = this.id === null ? 'start' : 'restart';
      this.start(id, K, B, total, crc);
    }
    if (this.done) return { status: 'finished' };
    if (this.seen.has(seed)) return { status: 'dup' };
    this.seen.add(seed);
    this.frames++;
    this.absorb(indices(seed, K, this.cdf), buf.slice(HEAD));
    if (this.known < K) return { status };
    const data = new Uint8Array(K * B);
    for (let k = 0; k < K; k++) data.set(this.blocks[k], k * B);
    const out = data.subarray(0, total);
    if (crc32(out) !== crc) { this.reset(); return { status: 'corrupt' }; }
    this.done = true;
    return { status: 'done', data: out };
  }
  absorb(idx, data) {
    const rest = [];
    for (const i of idx) {
      if (this.blocks[i]) xorInto(data, this.blocks[i]);
      else rest.push(i);
    }
    if (!rest.length) return;
    if (rest.length === 1) { this.resolve(rest[0], data); return; }
    const sym = { idx: new Set(rest), data };
    for (const i of rest) (this.byBlock[i] || (this.byBlock[i] = [])).push(sym);
  }
  resolve(first, firstData) {
    const stack = [[first, firstData]];
    while (stack.length) {
      const [i, d] = stack.pop();
      if (this.blocks[i]) continue;
      this.blocks[i] = d;
      this.known++;
      const list = this.byBlock[i];
      this.byBlock[i] = null;
      if (!list) continue;
      for (const sym of list) {
        if (!sym.idx.has(i)) continue;
        sym.idx.delete(i);
        xorInto(sym.data, d);
        if (sym.idx.size === 1) {
          const j = sym.idx.values().next().value;
          sym.idx.clear();
          if (!this.blocks[j]) stack.push([j, sym.data]);
        }
      }
    }
  }
}

return { HEAD, MAX_K, b45enc, b45dec, crc32, pack, unpack, Encoder, Decoder };
});
