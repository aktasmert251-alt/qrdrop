/* QRDrop — ekrandan kameraya, ağsız dosya aktarımı / screen-to-camera transfer with no network. */
(() => {
'use strict';

const Q = window.QRA;
const L = window.I18N;
const t = L.t;
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
const rid = () => crypto.getRandomValues(new Uint32Array(1))[0];

/* ---------- tercihler / preferences ---------- */
const prefs = (() => {
  const d = { density: 'normal', fps: '8', shrink: '1', lang: L.lang };
  try { return Object.assign(d, JSON.parse(localStorage.getItem('qrdrop.prefs') || '{}')); } catch { return d; }
})();
const savePrefs = () => { try { localStorage.setItem('qrdrop.prefs', JSON.stringify(prefs)); } catch { /* özel sekme */ } };

/* ---------- biçimleme / formatting ---------- */
const dec1 = s => (L.lang === 'tr' ? s.replace('.', ',') : s);
function fmtSize(n) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < 3) { n /= 1024; i++; }
  return (i ? dec1(n.toFixed(n < 10 ? 1 : 0)) : String(n)) + ' ' + u[i];
}
function fmtTime(sec) {
  sec = Math.max(1, Math.round(sec));
  if (sec < 60) return sec + ' ' + t('sec');
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ' ' + t('min') + (s ? ' ' + s + ' ' + t('sec') : '');
}
const fmtDate = ts => new Date(ts).toLocaleString(t('locale'), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const extOf = name => {
  const i = name.lastIndexOf('.');
  return (i > 0 ? name.slice(i + 1) : 'file').slice(0, 4).toLocaleUpperCase(t('locale'));
};
const isText = mime => /^text\/plain/.test(mime);
const isImage = mime => /^image\//.test(mime);
function toast(text, ms = 3000) {
  const n = el('div', 'toast', text);
  $('#toasts').append(n);
  setTimeout(() => n.remove(), ms);
}

/* ---------- kayıt / storage ---------- */
const db = (() => {
  let opening;
  const open = () => opening || (opening = new Promise((res, rej) => {
    const r = indexedDB.open('qrdrop', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const tx = d.transaction('items', mode);
      const rq = fn(tx.objectStore('items'));
      tx.oncomplete = () => res(rq && rq.result);
      tx.onerror = tx.onabort = () => rej(tx.error);
    });
  };
  return {
    all: () => run('readonly', s => s.getAll()).catch(() => []),
    put: item => run('readwrite', s => s.put(item)).catch(() => {}),
    del: id => run('readwrite', s => s.delete(id)).catch(() => {}),
  };
})();

/* ---------- ekran açık kalsın / keep screen on ---------- */
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

/* ---------- görünümler / views ---------- */
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

/* ---------- dil / language ---------- */
function applyLang() {
  L.setLang(prefs.lang);
  for (const b of $$('[data-lang]')) b.textContent = t('lang');
  $('#offline-state').lastElementChild.textContent = t(swState);
  renderEstimate();
  if (current === 'home') renderItems();
  if (current === 'send') { $('#pause').textContent = t(flow.paused ? 'resume' : 'pause'); tick(true); }
  if (current === 'recv') { recvHint(t(recv.hintKey), recv.hintWarn); if (recv.dec && recv.dec.info().K) renderRecv(); else $('#recv-detail').textContent = t('waiting'); }
  if (current === 'done' && openItem.last) openItem(openItem.last, openItem.lastFresh, true);
}

/* ---------- seçmeli düğmeler / segmented controls ---------- */
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
  if (key === 'density') { startSending(true); toast(t('densityChanged')); }
}

/* ======================= GÖNDERME / SEND ======================= */
const send = { kind: null, file: null, text: '', packed: null, name: '', mime: '', token: 0, previewUrl: null, busy: false, tooBig: false };

function clearChoice() {
  send.kind = null; send.file = null; send.packed = null; send.tooBig = false;
  send.token++;
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
  $('#chosen-name').textContent = file.name || t('fileName');
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
  send.tooBig = false;
  if (!send.kind) { renderEstimate(); return; }
  send.busy = true;
  renderEstimate();
  let name, mime, bytes;
  try {
    if (send.kind === 'text') {
      name = t('textName');
      mime = 'text/plain;charset=utf-8';
      bytes = new TextEncoder().encode(send.text);
    } else {
      const f = send.file;
      name = f.name || t('fileName');
      mime = f.type || 'application/octet-stream';
      let blob = f;
      if (isImage(mime) && prefs.shrink === '1') {
        const small = await shrinkImage(f);
        if (small) { blob = small; mime = 'image/jpeg'; name = name.replace(/\.[^.]*$/, '') + '.jpg'; }
      }
      bytes = blob.size > MAX_BYTES ? null : new Uint8Array(await blob.arrayBuffer());
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
  if (!send.kind) { est.textContent = t('pickFirst'); return; }
  if (send.busy) { est.textContent = t('preparing'); return; }
  $('#start-scan').disabled = true;
  if (send.tooBig || !send.packed) {
    est.append(el('span', 'warn', t('tooBig', { max: fmtSize(MAX_BYTES) })));
    return;
  }
  const K = Math.ceil(send.packed.length / DENSITY[prefs.density]);
  const best = K / Number(prefs.fps);
  const real = best * 1.35;   // kaçan kareler ve karışım payı / missed frames + coding overhead
  est.append(t('estimate', { size: fmtSize(send.packed.length), k: K }), el('b', null, fmtTime(best) + ' – ' + fmtTime(real)));
  if (real > 180) est.append(el('span', 'warn', t('longWarn')));
  start.disabled = false;
  $('#start-scan').disabled = false;
}

/* ---- akış / stream ---- */
const flow = { enc: null, timer: 0, shown: 0, paused: false };
function drawQR(canvas, text, mode = 'Alphanumeric', level = 'L') {
  const q = qrcode(0, level);
  q.addData(text, mode);
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
function tick(labelOnly) {
  if (!flow.enc) return;
  if (labelOnly !== true) {
    if (flow.paused) return;
    drawQR($('#qr'), flow.enc.next());
    flow.shown++;
  }
  $('#send-count').textContent = t('frameCount', { n: flow.shown, r: dec1((flow.shown / flow.enc.K).toFixed(1)) });
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
  $('#pause').textContent = t('pause');
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

/* ======================= ALMA / RECEIVE ======================= */
const recv = { mode: 'data', active: false, dec: null, cam: null, detector: null, firstAt: 0, lastValid: 0, uiQueued: false, hintTimer: 0, canvas: null, hintKey: 'aimHint', hintWarn: false };

function recvHint(text, warn) {
  const h = $('#recv-hint');
  h.textContent = text;
  h.classList.toggle('warn', !!warn);
}
function hint(key, warn) { recv.hintKey = key; recv.hintWarn = !!warn; recvHint(t(key), warn); }
function renderRecv() {
  recv.uiQueued = false;
  if (!recv.dec) return;
  const i = recv.dec.info();
  if (!i.K) return;
  const p = i.known / i.K;
  $('#recv-bar').style.transform = 'scaleX(' + p + ')';
  $('#recv-pct').textContent = '%' + Math.floor(p * 100);
  const secs = (performance.now() - recv.firstAt) / 1000;
  const rate = secs > 0.5 ? (i.known * i.B) / secs : 0;
  let detail = t('parts', { a: i.known, b: i.K }) + ' · ' + fmtSize(i.total);
  if (rate > 0) {
    detail += ' · ' + fmtSize(rate) + t('perSec');
    if (i.known < i.K) detail += ' · ≈ ' + fmtTime(((i.K - i.known) * i.B / rate) * 1.2);
  }
  $('#recv-detail').textContent = detail;
}
function queueRecvUi() {
  if (recv.uiQueued) return;
  recv.uiQueued = true;
  requestAnimationFrame(renderRecv);
}
/* "Bana gönder" kodu: uygulamanın kendi adresi + #send. Normal kamera uygulaması da okuyup açabilir. */
const reqUrl = () => new URL('./#send', location.href).href;
function isReqCode(text) {
  try {
    const u = new URL(text);
    const here = location.pathname.replace(/index\.html$/, '');
    return u.hash === '#send' && u.pathname.replace(/index\.html$/, '') === here;
  } catch { return false; }
}
function showReq(on) {
  const box = $('#req');
  if (on) drawQR($('#req-qr'), reqUrl(), 'Byte', 'M');
  box.hidden = !on;
}
function openSendFromReq() {
  show('setup');
  renderEstimate();
  toast(t('reqSeen'), 4000);
}

function onText(text) {
  if (!recv.active || !recv.dec) return;
  // Gönderen, alıcının "bana gönder" kodunu okutuyor: görünce akışı başlat.
  if (recv.mode === 'req') {
    if (!isReqCode(text)) { hint('scanReqWrong', true); return; }
    stopReceiving();
    if (navigator.vibrate) navigator.vibrate(60);
    startSending(false);
    toast(t('reqOk'), 4000);
    return;
  }
  if (isReqCode(text)) {
    if (!$('#req').hidden) return;   // kendi gösterdiğimiz kodu görmeyelim
    stopReceiving();
    openSendFromReq();
    return;
  }
  const r = recv.dec.add(text);
  if (r.status === 'foreign') { hint('foreign', true); return; }
  recv.lastValid = performance.now();
  if (r.status === 'start' || r.status === 'restart') {
    recv.firstAt = performance.now();
    if (r.status === 'restart') toast(t('restarted'));
  }
  if (r.status === 'corrupt') { hint('corrupt', true); return; }
  const stage = $('#v-recv');
  stage.classList.add('hit');
  clearTimeout(recv.flash);
  recv.flash = setTimeout(() => stage.classList.remove('hit'), 160);
  if (r.status === 'done') { queueRecvUi(); finishReceive(r.data); return; }
  if (recv.hintKey !== 'reading') hint('reading');
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
// Testler ve başka kaynaklar için: bir resmi doğrudan çözücüye ver. / Feed an image straight to the decoder.
window.qraFeedImage = source => {
  if (!recv.active) return false;
  const txt = decodeImage(source, source.naturalWidth || source.width, source.naturalHeight || source.height, false);
  if (txt) onText(txt);
  return !!txt;
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
async function startReceiving(mode) {
  recv.mode = mode === 'req' ? 'req' : 'data';
  $('#v-recv').classList.toggle('mode-req', recv.mode === 'req');
  show('recv');
  recv.dec = new Q.Decoder();
  recv.active = true;
  recv.firstAt = 0;
  recv.lastValid = 0;
  $('#recv-bar').style.transform = 'scaleX(0)';
  $('#recv-pct').textContent = '%0';
  $('#recv-detail').textContent = t('waiting');
  hint(recv.mode === 'req' ? 'scanReqHint' : 'aimHint');
  keepAwake(true);
  const v = $('#cam');
  try {
    const cam = await startCamera();
    if (!recv.active) { cam.getTracks().forEach(tr => tr.stop()); return; }
    recv.cam = cam;
    v.srcObject = cam;
    await v.play().catch(() => {});
  } catch {
    hint('noCam', true);
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
    if (recv.mode === 'req') return;
    if (!recv.lastValid && now - started > 6000) hint('cantRead', true);
    else if (recv.lastValid && now - recv.lastValid > 4000) hint('stalled', true);
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
  $('#req').hidden = true;
  clearInterval(recv.hintTimer);
  if (recv.cam) { recv.cam.getTracks().forEach(tr => tr.stop()); recv.cam = null; }
  $('#cam').srcObject = null;
  keepAwake(false);
}
async function finishReceive(data) {
  stopReceiving();
  if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
  const f = Q.unpack(data);
  if (!f) { toast(t('badData')); show('home'); return; }
  const item = { id: String(Date.now()) + '-' + rid(), name: f.name || t('fileName'), mime: f.mime || 'application/octet-stream', size: f.bytes.length, ts: Date.now() };
  item.blob = new Blob([f.bytes], { type: item.mime });
  await db.put(item);
  openItem(item, true);
}

/* ======================= GELENLER / RECEIVED ======================= */
const urls = new Map();
const urlFor = item => {
  if (!urls.has(item.id)) urls.set(item.id, URL.createObjectURL(item.blob));
  return urls.get(item.id);
};
function openItem(item, fresh, relabel) {
  openItem.last = item;
  openItem.lastFresh = fresh;
  if (!relabel) show('done', !fresh);
  $('#done-title').textContent = t(fresh ? 'doneTitle' : 'itemTitle');
  $('#done-name').textContent = item.name;
  $('#done-size').textContent = fmtSize(item.size) + ' · ' + fmtDate(item.ts);
  $('#done-ext').textContent = extOf(item.name);
  const view = $('#done-view');
  if (!relabel) {
    view.textContent = '';
    if (isImage(item.mime)) {
      const img = el('img');
      img.alt = item.name;
      img.onerror = () => img.remove();
      img.src = urlFor(item);
      view.append(img);
    } else if (isText(item.mime)) {
      const pre = el('pre');
      item.blob.text().then(x => { pre.textContent = x; });
      view.append(pre);
    }
  }
  const acts = $('#done-actions');
  acts.textContent = '';
  if (isText(item.mime)) {
    const c = el('button', 'btn', t('copy'));
    c.type = 'button';
    c.onclick = async () => {
      try { await navigator.clipboard.writeText(await item.blob.text()); c.textContent = t('copied'); } catch { c.textContent = t('copyFail'); }
      setTimeout(() => { c.textContent = t('copy'); }, 1400);
    };
    acts.append(c);
  }
  const a = el('a', 'btn', t('download'));
  a.href = urlFor(item);
  a.download = item.name;
  acts.append(a);
  try {
    const file = new File([item.blob], item.name, { type: item.mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      const s = el('button', 'btn', t(isImage(item.mime) ? 'saveGallery' : 'share'));
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
      const th = el('img', 'item-thumb');
      th.alt = '';
      th.src = urlFor(item);
      open.append(th);
    } else open.append(el('span', 'ext', extOf(item.name)));
    const info = el('div', 'chosen-info');
    info.append(el('div', 'chosen-name', item.name), el('div', 'chosen-size', fmtSize(item.size) + ' · ' + fmtDate(item.ts)));
    open.append(info);
    open.onclick = () => openItem(item, false);
    const del = el('button', 'icon-btn');
    del.type = 'button';
    del.setAttribute('aria-label', t('del') + ': ' + item.name);
    del.append(icon('trash'));
    del.onclick = async () => {
      if (!confirm(t('confirmDel', { name: item.name }))) return;
      await db.del(item.id);
      if (urls.has(item.id)) { URL.revokeObjectURL(urls.get(item.id)); urls.delete(item.id); }
      renderItems();
    };
    li.append(open, del);
    ul.append(li);
  }
}

/* ======================= BAŞLANGIÇ / START ======================= */
let swState = 'offlinePrep';
async function registerSW() {
  const st = $('#offline-state');
  const set = key => { swState = key; st.lastElementChild.textContent = t(key); };
  if (!('serviceWorker' in navigator)) { set('offlineNone'); return; }
  try {
    await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    st.classList.add('on');
    set('offlineReady');
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch { set('offlineFail'); }
}

function init() {
  wireSegs();
  syncSegs();
  applyLang();
  for (const b of $$('[data-lang]')) {
    b.onclick = () => { prefs.lang = L.lang === 'tr' ? 'en' : 'tr'; savePrefs(); applyLang(); };
  }
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
  $('#start-scan').onclick = () => { if (send.packed) startReceiving('req'); };
  // Kamera ekranındaki çarpı: gönderen kod okuturken gönderme hazırlığına, alırken ana sayfaya döner.
  $('.recv-x').onclick = () => { if (recv.mode === 'req') show('setup', false); else goHome(); };
  $('#pause').onclick = () => {
    flow.paused = !flow.paused;
    $('#pause').textContent = t(flow.paused ? 'resume' : 'pause');
  };
  $('#stop').onclick = () => show('setup', false);
  // Rol değişimi: kamerası uygun olan telefon alıcı olabilsin. / Swap roles in one tap.
  $('#swap-to-recv').onclick = () => { stopSending(); startReceiving(); toast(t('swappedRecv')); };
  $('#swap-to-send').onclick = () => { show('setup'); renderEstimate(); toast(t('swappedSend')); };
  $('#show-req').onclick = () => showReq(true);
  $('#req-done').onclick = () => { showReq(false); hint('aimHint'); };

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

  // Karşı telefon "bana gönder" kodunu normal kamerasıyla okuttuysa uygulama gönderme ekranında açılır.
  if (location.hash === '#send') {
    history.replaceState(null, '', location.pathname + location.search);
    openSendFromReq();
  }
}

init();
})();
