/* QRDrop metinleri: Türkçe ve İngilizce. */
(() => {
'use strict';

const S = {
  tr: {
    title: 'QRDrop — ağsız dosya aktarımı',
    tagline: 'ağ yok · hotspot yok · sadece ekran ve kamera',
    hero: 'İki telefon. Bir ekran, bir kamera. Arada hiçbir ağ yok.',
    send: 'GÖNDER', sendDesc: 'Bu ekran hızla değişen kodlar gösterir.',
    recv: 'AL', recvDesc: 'Kamera karşı ekrandaki kodları okur.',
    how: 'Nasıl çalışır',
    step1: 'Gönderen fotoğraf, dosya ya da metin seçip <b>QR GÖSTER</b>\'e basar; ekranda kodlar akmaya başlar. İsterse önce alıcının kodunu okutur (<b>QR OKUT</b>).',
    step2: 'Alan <b>AL</b>\'a basıp kamerasını o ekrana 20–30 cm\'den tutar. İsterse önce <b>QR GÖSTER</b> ile “bana gönder” kodu açar.',
    step3: 'Çubuk %100 olunca dosya alan telefona kaydedilir. Kaçan kareler sorun değil; akış hepsini telafi eder.',
    received: 'Gelenler', noItems: 'Henüz bir şey alınmadı.',
    offlinePrep: 'Çevrimdışı kullanım hazırlanıyor…', offlineReady: 'Çevrimdışı kullanıma hazır',
    offlineNone: 'Bu tarayıcıda çevrimdışı kurulum yok.', offlineFail: 'Çevrimdışı kurulum yapılamadı.',
    install: 'UYGULAMA OLARAK KUR', iosHint: 'iPhone\'da kurmak için: Safari\'de Paylaş → “Ana Ekrana Ekle”.',
    back: 'Geri', close: 'Kapat', clear: 'Seçimi kaldır', cancel: 'İptal', del: 'Sil',
    what: 'Ne gönderilecek', photo: 'FOTOĞRAF', file: 'DOSYA', textPh: '…ya da buraya bir metin yaz',
    photoSize: 'Fotoğraf boyutu', shrink: 'KÜÇÜLT', shrinkSub: 'hızlı', original: 'ORİJİNAL', originalSub: 'yavaş',
    density: 'Kod yoğunluğu', easy: 'KOLAY', easySub: 'zor koşul', normal: 'NORMAL', normalSub: 'önerilen', fast: 'HIZLI', fastSub: 'iyi kamera',
    speed: 'Akış hızı', fps: 'kare/sn', fpsShort: '/sn',
    pickFirst: 'Önce bir şey seç.', preparing: 'Hazırlanıyor…',
    tooBig: 'Bu dosya çok büyük. Sınır {max}; fotoğrafsa KÜÇÜLT seçeneğini kullan.',
    estimate: 'Gönderilecek: {size} · {k} parça · süre ≈ ', longWarn: ' · uzun sürer, telefonları sabitleyin',
    start: 'QR GÖSTER · HEMEN BAŞLAT',
    startScan: 'QR OKUT · ALICI HAZIR OLUNCA BAŞLAT',
    startNote: 'QR OKUT: alan telefon AL → QR GÖSTER ile bir kod açar; onu okutunca akış kendiliğinden başlar.',
    scanReqHint: 'Alan telefonun ekranındaki BANA GÖNDER kodunu okutun.',
    scanReqWrong: 'Bu bir BANA GÖNDER kodu değil. Alan telefonda AL → QR GÖSTER\'e basılmalı.',
    reqOk: 'Alıcı hazır. Ekranı alan telefonun kamerasına çevirin.',
    sendHint: 'Alan telefonda çubuk %100 olunca <b>BİTİR</b>\'e basın.',
    pause: 'DURAKLAT', resume: 'DEVAM', stop: 'BİTİR',
    frameCount: 'kare {n} · {r} tur',
    swapToRecv: '⇄ ROLÜ DEĞİŞ · BU TELEFON ALSIN', swapToSend: '⇄ ROLÜ DEĞİŞ · BU TELEFON GÖNDERSİN',
    swappedRecv: 'Bu telefon artık alıyor. Diğerinde GÖNDER\'e basın.', swappedSend: 'Bu telefon artık gönderiyor. Diğerinde AL\'a basın.',
    densityChanged: 'Yoğunluk değişti; alan telefon baştan başlar.',
    waiting: 'Kod bekleniyor…', aimHint: 'Kamerayı gönderen ekrana 20–30 cm\'den, karşı karşıya tutun.',
    foreign: 'Bu bir QRDrop kodu değil. Gönderen ekrana tutun.', restarted: 'Gönderen ayarı değişti; baştan başlandı.',
    corrupt: 'Veri bozuk çıktı; baştan alınıyor.', reading: 'Okunuyor. Telefonları sabit tutun.',
    cantRead: 'Kod okunamıyor. Mesafeyi 20–30 cm yapın, gönderen ekranın parlaklığını sonuna açın ya da yoğunluğu KOLAY seçin.',
    stalled: 'Okuma durdu. Kamerayı yeniden ekrana çevirin.',
    noCam: 'Kamera açılamadı. Tarayıcı ayarlarından bu siteye kamera izni verin.',
    parts: '{a}/{b} parça', perSec: '/sn',
    badData: 'Gelen veri açılamadı.',
    doneTitle: 'ALINDI', itemTitle: 'GELEN', again: 'YENİ AL',
    copy: 'KOPYALA', copied: 'KOPYALANDI', copyFail: 'KOPYALANAMADI', download: 'İNDİR', saveGallery: 'GALERİYE KAYDET', share: 'PAYLAŞ',
    confirmDel: '{name} silinsin mi?', textName: 'mesaj.txt', fileName: 'dosya',
    showReq: 'QR GÖSTER · BANA GÖNDERSİN',
    reqTag: 'BANA GÖNDER',
    reqTitle: 'Gönderecek telefon bu kodu okutsun.',
    reqText: 'Karşı telefon GÖNDER → QR OKUT ile okutursa akış hemen başlar. AL ekranıyla ya da kendi kamerasıyla okutursa gönderme ekranı açılır. Akış başlayınca buradan KAMERAYA GEÇ\'e basın.',
    reqDone: 'KAMERAYA GEÇ',
    reqSeen: 'Karşı telefon almak istiyor. Göndereceğin şeyi seç.',
    sec: 'sn', min: 'dk', locale: 'tr-TR', lang: 'EN',  },
  en: {
    title: 'QRDrop — file transfer without a network',
    tagline: 'no network · no hotspot · just a screen and a camera',
    hero: 'Two phones. One screen, one camera. No network in between.',
    send: 'SEND', sendDesc: 'This screen shows a stream of changing codes.',
    recv: 'RECEIVE', recvDesc: 'The camera reads the codes on the other screen.',
    how: 'How it works',
    step1: 'The sender picks a photo, file or text and taps <b>SHOW QR</b>; codes start streaming on screen. Or it first scans the receiver\'s code (<b>SCAN QR</b>).',
    step2: 'The receiver taps <b>RECEIVE</b> and holds the camera 20–30 cm from that screen. Or it first opens a “send to me” code with <b>SHOW QR</b>.',
    step3: 'At 100% the file is saved on the receiving phone. Missed frames are fine; the stream makes up for them.',
    received: 'Received', noItems: 'Nothing received yet.',
    offlinePrep: 'Preparing offline use…', offlineReady: 'Ready to use offline',
    offlineNone: 'This browser can\'t install for offline use.', offlineFail: 'Offline setup failed.',
    install: 'INSTALL AS APP', iosHint: 'To install on iPhone: in Safari tap Share → “Add to Home Screen”.',
    back: 'Back', close: 'Close', clear: 'Remove selection', cancel: 'Cancel', del: 'Delete',
    what: 'What to send', photo: 'PHOTO', file: 'FILE', textPh: '…or type a message here',
    photoSize: 'Photo size', shrink: 'SHRINK', shrinkSub: 'fast', original: 'ORIGINAL', originalSub: 'slow',
    density: 'Code density', easy: 'EASY', easySub: 'tough light', normal: 'NORMAL', normalSub: 'recommended', fast: 'FAST', fastSub: 'good camera',
    speed: 'Stream speed', fps: 'frames/s', fpsShort: '/s',
    pickFirst: 'Pick something first.', preparing: 'Preparing…',
    tooBig: 'This file is too big. The limit is {max}; for photos, use SHRINK.',
    estimate: 'Sending: {size} · {k} parts · time ≈ ', longWarn: ' · takes a while, keep the phones steady',
    start: 'SHOW QR · START NOW',
    startScan: 'SCAN QR · START WHEN RECEIVER IS READY',
    startNote: 'SCAN QR: the receiving phone opens a code via RECEIVE → SHOW QR; scanning it starts the stream automatically.',
    scanReqHint: 'Scan the SEND TO ME code on the receiving phone\'s screen.',
    scanReqWrong: 'That isn\'t a SEND TO ME code. On the receiving phone tap RECEIVE → SHOW QR.',
    reqOk: 'Receiver is ready. Turn this screen toward its camera.',
    sendHint: 'Tap <b>FINISH</b> when the receiving phone reaches 100%.',
    pause: 'PAUSE', resume: 'RESUME', stop: 'FINISH',
    frameCount: 'frame {n} · {r} rounds',
    swapToRecv: '⇄ SWAP ROLES · THIS PHONE RECEIVES', swapToSend: '⇄ SWAP ROLES · THIS PHONE SENDS',
    swappedRecv: 'This phone is now receiving. Tap SEND on the other one.', swappedSend: 'This phone is now sending. Tap RECEIVE on the other one.',
    densityChanged: 'Density changed; the receiver starts over.',
    waiting: 'Waiting for codes…', aimHint: 'Hold the camera 20–30 cm from the sending screen, facing it.',
    foreign: 'That\'s not a QRDrop code. Aim at the sending screen.', restarted: 'The sender changed settings; starting over.',
    corrupt: 'The data came out corrupted; starting over.', reading: 'Reading. Keep the phones steady.',
    cantRead: 'Can\'t read the code. Keep 20–30 cm apart, turn the sending screen\'s brightness all the way up, or pick EASY density.',
    stalled: 'Reading stopped. Point the camera back at the screen.',
    noCam: 'Couldn\'t open the camera. Allow camera access for this site in the browser settings.',
    parts: '{a}/{b} parts', perSec: '/s',
    badData: 'The received data couldn\'t be opened.',
    doneTitle: 'RECEIVED', itemTitle: 'RECEIVED ITEM', again: 'RECEIVE AGAIN',
    copy: 'COPY', copied: 'COPIED', copyFail: 'COPY FAILED', download: 'DOWNLOAD', saveGallery: 'SAVE TO PHOTOS', share: 'SHARE',
    confirmDel: 'Delete {name}?', textName: 'message.txt', fileName: 'file',
    showReq: 'SHOW QR · SEND TO ME',
    reqTag: 'SEND TO ME',
    reqTitle: 'Have the sending phone scan this code.',
    reqText: 'If the other phone scans it with SEND → SCAN QR, the stream starts right away. If it scans with the RECEIVE screen or its own camera, its send screen opens. Once the stream starts, tap SWITCH TO CAMERA here.',
    reqDone: 'SWITCH TO CAMERA',
    reqSeen: 'The other phone wants to receive. Pick what to send.',
    sec: 's', min: 'min', locale: 'en-GB', lang: 'TR',  },
};

const pick = () => {
  try { const v = JSON.parse(localStorage.getItem('qrdrop.prefs') || '{}').lang; if (v === 'tr' || v === 'en') return v; } catch { /* yok */ }
  return /^tr\b/i.test(navigator.language || '') ? 'tr' : 'en';
};
let lang = pick();

function t(key, vars) {
  let s = (S[lang] && S[lang][key]) ?? S.tr[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
  return s;
}
function apply(root = document) {
  document.documentElement.lang = lang;
  document.title = t('title');
  for (const e of root.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
  for (const e of root.querySelectorAll('[data-i18n-html]')) e.innerHTML = t(e.dataset.i18nHtml);   // yalnızca yukarıdaki sabit metinler
  for (const e of root.querySelectorAll('[data-i18n-ph]')) e.placeholder = t(e.dataset.i18nPh);
  for (const e of root.querySelectorAll('[data-i18n-aria]')) e.setAttribute('aria-label', t(e.dataset.i18nAria));
  document.documentElement.style.setProperty('--empty-items', JSON.stringify(t('noItems')));
}
function setLang(v) { lang = v === 'en' ? 'en' : 'tr'; apply(); }

window.I18N = { t, apply, setLang, get lang() { return lang; } };
})();
