/* QR Aktar — ekrandan kameraya, ağsız dosya aktarımı. */
(() => {
'use strict';

const Q = window.QRA;
const DENSITY = { kolay: 280, normal: 520, hizli: 800 };
const MAX_BYTES = 8 * 1024 * 1024;
const SHRINK_SIDE = 1280;
const SHRINK_QUALITY = 0.72;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const SVGNS = 'http://www.w3.org/2000/svg';
const icon = name => {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('class', 'ic');
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVGNS, 'use');
  u.setAttribute('href', '#i-' + name);
  s.appendChild(u);
  return s;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rid = () => crypto.getRandomValues(new Uint32Array(1))[0];

/* ---------- tercihler ---------- */
const prefs = (() => {
  const d = { density: 'normal', fps: '8', shrink: '1' };
  try { return Object.assign(d, JSON.parse(localStorage.getItem('qra.prefs') || '{}')); } catch { return d; }
})();
const savePrefs = () => { try { localStorage.setItem('qra.prefs', JSON.stringify(prefs)); } catch { /* özel sekme */ } };

/* ---------- biçimleme ---------- */
function fmtSize(n) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < 3) { n /= 1024; i++; }
  return (i ? n.toFixed(n < 10 ? 1 : 0).replace('.', ',') : String(n)) + ' ' + u[i];
}
function fmtTime(sec) {
  sec = Math.max(1, Math.round(sec));
  if (sec < 60) return sec + ' sn';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ' dk' + (s ? ' ' + s + ' sn' : '');
}
const extOf = name => {
  const i = name.lastIndexOf('.');
  return (i > 0 ? name.slice(i + 1) : 'dosya').slice(0, 4).toLocaleUpperCase('tr-TR');
};
const isText = mime => /^text\/plain/.test(mime);
const isImage = mime => /^image\//.test(mime);
function toast(text, ms = 3000) {
  const t = el('div', 'toast', text);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------- kayıt (gelenler) ---------- */
const db = (() => {
  let opening;
  const open = () => opening || (opening = new Promise((res, rej) => {
    const r = indexedDB.open('qr-aktar', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction('items', mode);
      const rq = fn(t.objectStore('items'));
      t.oncomplete = () => res(rq && rq.result);
      t.onerror = t.onabort = () => rej(t.error);
    });
  };
  return {
    all: () => run('readonly', s => s.getAll()).catch(() => []),
    put: item => run('readwrite', s => s.put(item)).catch(() => {}),
    del: id => run('readwrite', s => s.delete(id)).catch(() => {}),
  };
})();

/* ---------- ekran açık kalsın ---------- */
let wake = null;
async function keepAwake(on) {
  try {
    if (on && !wake && navigator.wakeLock) {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    } else if (!on && wake) { const w = wake; wake = null; await w.release(); }
  } catch { /* desteklenmiyor */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (current === 'send' || current === 'recv')) keepAwake(true);
});

/* ---------- görünümler ---------- */
let current = 'home';
function show(name, push = true) {
  if (current === 'send' && name !== 'send') stopSending();
  if (current === 'recv' && name !== 'recv') stopReceiving();
  for (const v of $$('.view')) v.hidden = v.id !== 'v-' + name;
  if (push && name !== 'home' && current === 'home') history.pushState({ v: name }, '');
  current = name;
  window.scrollTo(0, 0);
  if (name === 'home') renderItems();
}
addEventListener('popstate', () => { if (current !== 'home') show('home', false); });
function goHome() {
  if (current === 'home') return;
  if (history.state && history.state.v) history.back();
  else show('home', false);
}

/* ---------- seçmeli düğmeler ---------- */
function syncSegs() {
  for (const seg of $$('.seg')) {
    const key = seg.dataset.pref;
    for (const b of $$('button', seg)) b.setAttribute('aria-pressed', String(b.dataset.v === prefs[key]));
  }
}
function wireSegs() {
  for (const seg of $$('.seg')) {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || prefs[seg.dataset.pref] === b.dataset.v) return;
      prefs[seg.dataset.pref] = b.dataset.v;
      savePrefs();
      syncSegs();
      onPrefChange(seg.dataset.pref, seg.hasAttribute('data-live'));
    });
  }
}
function onPrefChange(key, live) {
  if (key === 'shrink') prepare();
  else renderEstimate();
  if (!live || current !== 'send') return;
  if (key === 'fps') restartTimer();
  if (key === 'density') { startSending(true); toast('Yoğunluk değişti; alan telefon baştan başlar.'); }
}

/* ======================= GÖNDERME ======================= */
const send = { kind: null, file: null, text: '', packed: null, name: '', mime: '', token: 0, previewUrl: null, busy: false };

function clearChoice() {
  send.kind = null; send.file = null; send.packed = null;
  if (send.previewUrl) { URL.revokeObjectURL(send.previewUrl); send.previewUrl = null; }
  $('#chosen').hidden = true;
  $('#opt-shrink').hidden = true;
  renderEstimate();
}
function chooseFile(file) {
  if (!file) return;
  clearChoice();
  $('#send-text').value = '';
  send.kind = 'file';
  send.file = file;
  const img = isImage(file.type);
  $('#chosen').hidden = false;
  $('#chosen-name').textContent = file.name || 'dosya';
  $('#chosen-size').textContent = fmtSize(file.size);
  $('#chosen-ext').textContent = extOf(file.name || '');
  const pic = $('#chosen-img');
  pic.hidden = !img;
  if (img) { send.previewUrl = URL.createObjectURL(file); pic.src = send.previewUrl; }
  $('#opt-shrink').hidden = !img;
  prepare();
}
function chooseText(text) {
  if (send.kind === 'file') clearChoice();
  send.kind = text.trim() ? 'text' : null;
  send.text = text;
  prepare();
}

async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const k = Math.min(1, SHRINK_SIDE / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', SHRINK_QUALITY));
    return blob && blob.size < file.size ? blob : null;
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

async function prepare() {
  const token = ++send.token;
  send.packed = null;
  renderEstimate();
  if (!send.kind) return;
  send.busy = true;
  renderEstimate();
  let name, mime, bytes;
  try {
    if (send.kind === 'text') {
      name = 'mesaj.txt';
      mime = 'text/plain;charset=utf-8';
      bytes = new TextEncoder().encode(send.text);
    } else {
      const f = send.file;
      name = f.name || 'dosya';
      mime = f.type || 'application/octet-stream';
      let blob = f;
      if (isImage(mime) && prefs.shrink === '1') {
        const small = await shrinkImage(f);
        if (small) { blob = small; mime = 'image/jpeg'; name = name.replace(/\.[^.]*$/, '') + '.jpg'; }
      }
      if (blob.size > MAX_BYTES) { bytes = null; } else bytes = new Uint8Array(await blob.arrayBuffer());
    }
  } catch { bytes = null; }
  if (token !== send.token) return;
  send.busy = false;
  send.name = name;
  send.mime = mime;
  send.packed = bytes ? Q.pack(name, mime, bytes) : null;
  send.tooBig = !bytes;
  renderEstimate();
}

function renderEstimate() {
  const est = $('#estimate');
  const start = $('#start');
  start.disabled = true;
  est.textContent = '';
  if (!send.kind) { est.textContent = 'Önce bir şey seç.'; return; }
  if (send.busy) { est.textContent = 'Hazırlanıyor…'; return; }
  if (send.tooBig || !send.packed) {
    est.append(el('span', 'warn', 'Bu dosya çok büyük. Sınır ' + fmtSize(MAX_BYTES) + '; fotoğrafsa KÜÇÜLT seçeneğini kullan.'));
    return;
  }
  const B = DENSITY[prefs.density];
  const K = Math.ceil(send.packed.length / B);
  const fps = Number(prefs.fps);
  const best = K / fps;
  const real = best * 1.35;  // kaçan kareler ve karışım payı
  const b = el('b', null, fmtTime(best) + ' – ' + fmtTime(real));
  est.append('Gönderilecek: ' + fmtSize(send.packed.length) + ' · ' + K + ' parça · süre ≈ ', b);
  if (real > 180) est.append(el('span', 'warn', ' · uzun sürer, telefonları sabitleyin'));
  start.disabled = false;
}

/* ---- akış ---- */
const flow = { enc: null, timer: 0, shown: 0, paused: false };
function drawQR(canvas, text) {
  const q = qrcode(0, 'L');
  q.addData(text, 'Alphanumeric');
  q.make();
  const n = q.getModuleCount(), pad = 4, size = n + pad * 2;
  if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  d.fill(255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!q.isDark(r, c)) continue;
      const i = ((r + pad) * size + c + pad) * 4;
      d[i] = d[i + 1] = d[i + 2] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);
}
function tick() {
  if (flow.paused || !flow.enc) return;
  drawQR($('#qr'), flow.enc.next());
  flow.shown++;
  const K = flow.enc.K;
  $('#send-count').textContent = 'kare ' + flow.shown + ' · ' + (flow.shown / K).toFixed(1).replace('.', ',') + ' tur';
}
function restartTimer() {
  clearInterval(flow.timer);
  flow.timer = setInterval(tick, 1000 / Number(prefs.fps));
}
function startSending(restart) {
  if (!send.packed) return;
  flow.enc = new Q.Encoder(send.packed, DENSITY[prefs.density], rid());
  flow.shown = 0;
  flow.paused = false;
  $('#pause').textContent = 'DURAKLAT';
  $('#send-name').textContent = send.name + ' · ' + fmtSize(send.packed.length);
  if (!restart) show('send');
  syncSegs();
  tick();
  restartTimer();
  keepAwake(true);
}
function stopSending() {
  clearInterval(flow.timer);
  flow.enc = null;
  keepAwake(false);
}

/* ======================= ALMA ======================= */
const recv = { active: false, dec: null, cam: null, detector: null, firstAt: 0, lastValid: 0, lastSeen: 0, uiQueued: false, hintTimer: 0, canvas: null };

function recvHint(text, warn) {
  const h = $('#recv-hint');
  h.textContent = text;
  h.classList.toggle('warn', !!warn);
}
function renderRecv() {
  recv.uiQueued = false;
  const i = recv.dec.info();
  if (!i.K) return;
  const p = i.known / i.K;
  $('#recv-bar').style.transform = 'scaleX(' + p + ')';
  $('#recv-pct').textContent = '%' + Math.floor(p * 100);
  const secs = (performance.now() - recv.firstAt) / 1000;
  const rate = secs > 0.5 ? (i.known * i.B) / secs : 0;
  let detail = i.known + '/' + i.K + ' parça · ' + fmtSize(i.total);
  if (rate > 0) {
    detail += ' · ' + fmtSize(rate) + '/sn';
    if (i.known < i.K) detail += ' · ≈ ' + fmtTime(((i.K - i.known) * i.B / rate) * 1.2);
  }
  $('#recv-detail').textContent = detail;
}
function queueRecvUi() {
  if (recv.uiQueued) return;
  recv.uiQueued = true;
  requestAnimationFrame(renderRecv);
}
function onText(text) {
  if (!recv.active || !recv.dec) return;
  recv.lastSeen = performance.now();
  const r = recv.dec.add(text);
  if (r.status === 'foreign') { recvHint('Bu bir QR Aktar kodu değil. Gönderen ekrana tutun.', true); return; }
  recv.lastValid = performance.now();
  if (r.status === 'start' || r.status === 'restart') {
    recv.firstAt = performance.now();
    if (r.status === 'restart') toast('Gönderen ayarı değişti; baştan başlandı.');
  }
  if (r.status === 'corrupt') { recvHint('Veri bozuk çıktı; baştan alınıyor.', true); return; }
  const stage = $('#v-recv');
  stage.classList.add('hit');
  clearTimeout(recv.flash);
  recv.flash = setTimeout(() => stage.classList.remove('hit'), 160);
  if (r.status === 'done') { queueRecvUi(); finishReceive(r.data); return; }
  recvHint('Okunuyor. Telefonları sabit tutun.');
  queueRecvUi();
}

function decodeImage(source, sw, sh, crop) {
  const side = crop ? Math.min(sw, sh) * 0.94 : 0;
  const sx = crop ? (sw - side) / 2 : 0, sy = crop ? (sh - side) / 2 : 0;
  const w = crop ? side : sw, h = crop ? side : sh;
  const k = Math.min(1, 960 / Math.max(w, h));
  const c = recv.canvas || (recv.canvas = document.createElement('canvas'));
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, sx, sy, w, h, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  return r && r.data ? r.data : null;
}
// Testler ve ileride başka kaynaklar için: bir resmi doğrudan çözücüye ver.
window.qraFeedImage = source => {
  if (!recv.active) return false;
  const t = decodeImage(source, source.naturalWidth || source.width, source.naturalHeight || source.height, false);
  if (t) onText(t);
  return !!t;
};

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
  const s = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
  });
  const track = s.getVideoTracks()[0];
  try {
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (caps.focusMode && caps.focusMode.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
  } catch { /* odak ayarı yok */ }
  return s;
}
async function startReceiving() {
  show('recv');
  recv.dec = new Q.Decoder();
  recv.active = true;
  recv.firstAt = 0;
  recv.lastValid = 0;
  recv.lastSeen = 0;
  $('#recv-bar').style.transform = 'scaleX(0)';
  $('#recv-pct').textContent = '%0';
  $('#recv-detail').textContent = 'Kod bekleniyor…';
  recvHint('Kamerayı gönderen ekrana 20–30 cm\'den, karşı karşıya tutun.');
  keepAwake(true);
  const v = $('#cam');
  try {
    recv.cam = await startCamera();
    if (!recv.active) { recv.cam.getTracks().forEach(t => t.stop()); recv.cam = null; return; }
    v.srcObject = recv.cam;
    await v.play().catch(() => {});
  } catch {
    recvHint('Kamera açılamadı. Tarayıcı ayarlarından bu siteye kamera izni verin.', true);
    return;
  }
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) recv.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch { recv.detector = null; }
  }
  const started = performance.now();
  clearInterval(recv.hintTimer);
  recv.hintTimer = setInterval(() => {
    if (!recv.active) return;
    const now = performance.now();
    if (!recv.lastValid && now - started > 6000) {
      recvHint('Kod okunamıyor. Mesafeyi 20–30 cm yapın, gönderen ekranın parlaklığını sonuna açın ya da yoğunluğu KOLAY seçin.', true);
    } else if (recv.lastValid && now - recv.lastValid > 4000) {
      recvHint('Okuma durdu. Kamerayı yeniden ekrana çevirin.', true);
    }
  }, 1000);
  scanLoop(v);
}
async function scanLoop(v) {
  const nextFrame = () => new Promise(r => {
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => r());
    else setTimeout(r, 33);
  });
  while (recv.active) {
    await nextFrame();
    if (!recv.active) return;
    if (v.readyState < 2 || !v.videoWidth) continue;
    let text = null;
    if (recv.detector) {
      try {
        const found = await recv.detector.detect(v);
        if (found.length) text = found[0].rawValue;
      } catch { recv.detector = null; }
    }
    if (!recv.detector) text = decodeImage(v, v.videoWidth, v.videoHeight, true);
    if (text) onText(text);
  }
}
function stopReceiving() {
  recv.active = false;
  clearInterval(recv.hintTimer);
  if (recv.cam) { recv.cam.getTracks().forEach(t => t.stop()); recv.cam = null; }
  $('#cam').srcObject = null;
  keepAwake(false);
}
async function finishReceive(data) {
  stopReceiving();
  if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
  const f = Q.unpack(data);
  if (!f) { toast('Gelen veri açılamadı.'); show('home'); return; }
  const item = { id: String(Date.now()) + '-' + rid(), name: f.name || 'dosya', mime: f.mime || 'application/octet-stream', size: f.bytes.length, ts: Date.now() };
  item.blob = new Blob([f.bytes], { type: item.mime });
  await db.put(item);
  openItem(item, true);
}

/* ======================= GELENLER ======================= */
const urls = new Map();
const urlFor = item => {
  if (!urls.has(item.id)) urls.set(item.id, URL.createObjectURL(item.blob));
  return urls.get(item.id);
};
function openItem(item, fresh) {
  show('done', !fresh);
  $('#done-title').textContent = fresh ? 'ALINDI' : 'GELEN';
  $('#done-name').textContent = item.name;
  $('#done-size').textContent = fmtSize(item.size) + ' · ' + new Date(item.ts).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  $('#done-ext').textContent = extOf(item.name);
  const view = $('#done-view');
  view.textContent = '';
  const url = urlFor(item);
  if (isImage(item.mime)) {
    const img = el('img');
    img.alt = item.name;
    img.onerror = () => img.remove();
    img.src = url;
    view.append(img);
  } else if (isText(item.mime)) {
    const pre = el('pre');
    item.blob.text().then(t => { pre.textContent = t; });
    view.append(pre);
  }
  const acts = $('#done-actions');
  acts.textContent = '';
  if (isText(item.mime)) {
    const c = el('button', 'btn', 'KOPYALA');
    c.type = 'button';
    c.onclick = async () => {
      try { await navigator.clipboard.writeText(await item.blob.text()); c.textContent = 'KOPYALANDI'; } catch { c.textContent = 'KOPYALANAMADI'; }
      setTimeout(() => { c.textContent = 'KOPYALA'; }, 1400);
    };
    acts.append(c);
  }
  const a = el('a', 'btn', 'İNDİR');
  a.href = url;
  a.download = item.name;
  acts.append(a);
  try {
    const file = new File([item.blob], item.name, { type: item.mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      const s = el('button', 'btn', isImage(item.mime) ? 'GALERİYE KAYDET' : 'PAYLAŞ');
      s.type = 'button';
      s.onclick = () => navigator.share({ files: [file] }).catch(() => {});
      acts.append(s);
    }
  } catch { /* paylaşım yok */ }
}
async function renderItems() {
  const list = (await db.all()).sort((a, b) => b.ts - a.ts);
  const ul = $('#items');
  ul.textContent = '';
  for (const item of list) {
    const li = el('li', 'item');
    const open = el('button', 'item-open');
    open.type = 'button';
    if (isImage(item.mime)) {
      const t = el('img', 'item-thumb');
      t.alt = '';
      t.src = urlFor(item);
      open.append(t);
    } else open.append(el('span', 'ext', extOf(item.name)));
    const info = el('div', 'chosen-info');
    info.append(el('div', 'chosen-name', item.name), el('div', 'chosen-size', fmtSize(item.size) + ' · ' + new Date(item.ts).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })));
    open.append(info);
    open.onclick = () => openItem(item, false);
    const del = el('button', 'icon-btn');
    del.type = 'button';
    del.setAttribute('aria-label', item.name + ' sil');
    del.append(icon('trash'));
    del.onclick = async () => {
      if (!confirm(item.name + ' silinsin mi?')) return;
      await db.del(item.id);
      if (urls.has(item.id)) { URL.revokeObjectURL(urls.get(item.id)); urls.delete(item.id); }
      renderItems();
    };
    li.append(open, del);
    ul.append(li);
  }
}

/* ======================= BAŞLANGIÇ ======================= */
async function registerSW() {
  const st = $('#offline-state');
  const txt = st.lastElementChild;
  if (!('serviceWorker' in navigator)) { txt.textContent = 'Bu tarayıcıda çevrimdışı kurulum yok.'; return; }
  try {
    await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    st.classList.add('on');
    txt.textContent = 'Çevrimdışı kullanıma hazır';
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch { txt.textContent = 'Çevrimdışı kurulum yapılamadı.'; }
}

function init() {
  wireSegs();
  syncSegs();
  $('#go-send').onclick = () => { show('setup'); renderEstimate(); };
  $('#go-recv').onclick = startReceiving;
  for (const b of $$('[data-home]')) b.onclick = goHome;
  $('#again').onclick = () => { show('home', false); startReceiving(); };
  $('#pick-photo-btn').onclick = () => $('#pick-photo').click();
  $('#pick-file-btn').onclick = () => $('#pick-file').click();
  for (const id of ['#pick-photo', '#pick-file']) {
    $(id).onchange = e => { chooseFile(e.target.files[0]); e.target.value = ''; };
  }
  $('#chosen-clear').onclick = clearChoice;
  $('#send-text').addEventListener('input', e => chooseText(e.target.value));
  $('#start').onclick = () => startSending(false);
  $('#pause').onclick = () => {
    flow.paused = !flow.paused;
    $('#pause').textContent = flow.paused ? 'DEVAM' : 'DURAKLAT';
  };
  $('#stop').onclick = () => show('setup', false);

  let installEvt = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#install').hidden = false; });
  $('#install').onclick = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice.catch(() => {});
    installEvt = null;
    $('#install').hidden = true;
  };
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone) $('#ios-hint').hidden = false;

  renderItems();
  registerSW();
}

init();
})();
