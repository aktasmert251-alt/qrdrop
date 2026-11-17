/* Tarayıcı testi: gönderen sayfanın ekranındaki kareler, alan sayfanın QR okuyucusuna verilir.
   Kullanım: node test/e2e.js <playwright modül yolu> [adres] */
'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { chromium } = require(process.argv[2] || 'playwright');

const URL_ = process.argv[3] || 'http://localhost:4781/';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); if (!cond) fails++; };

async function phone(browser, dark) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: dark ? 'dark' : 'light', permissions: ['camera'], locale: 'tr-TR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.goto(URL_);
  const overflow = [];
  // Her tıklamadan önce sayfanın ekrandan geniş olup olmadığını kaydet
  const click = page.click.bind(page);
  page.click = async (sel, o) => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth, [...document.querySelectorAll('.view')].find(v => !v.hidden)?.id]).catch(() => null); if (w && w[0] > w[1]) overflow.push(w[2] + ' ' + w[0] + '>' + w[1]); return click(sel, o); };
  return { ctx, page, errors, overflow };
}

// Gönderenin kanvasını büyütüp PNG olarak al, alanın okuyucusuna ver. Kaçan kareler doğal olarak oluşur.
async function pump(S, R, untilDone, maxMs) {
  const t0 = Date.now();
  let fed = 0, hits = 0;
  while (Date.now() - t0 < maxMs) {
    const url = await S.page.evaluate(() => {
      const src = document.querySelector('#qr');
      const c = document.createElement('canvas');
      c.width = c.height = src.width * 4;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    });
    const hit = await R.page.evaluate(async u => {
      const img = new Image();
      img.src = u;
      await img.decode();
      return window.qraFeedImage(img);
    }, url);
    fed++;
    if (hit) hits++;
    if (await R.page.evaluate(() => !document.querySelector('#v-done').hidden)) break;
  }
  return { fed, hits, ms: Date.now() - t0 };
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const S = await phone(browser);
  const R = await phone(browser, true);

  await S.page.screenshot({ path: path.join(OUT, '01-home.png') });

  // 1) 60 KB rastgele dosya, NORMAL yoğunluk
  const bin = crypto.randomBytes(60 * 1024);
  await S.page.click('#go-send');
  await S.page.setInputFiles('#pick-file', { name: 'ölçüm verisi.bin', mimeType: 'application/octet-stream', buffer: bin });
  await S.page.waitForSelector('#start:not([disabled])');
  ok('Tahmini süre gösteriliyor', /parça · süre/.test(await S.page.textContent('#estimate')), await S.page.textContent('#estimate'));
  await S.page.screenshot({ path: path.join(OUT, '02-setup-file.png') });
  await S.page.click('#start');
  await S.page.waitForTimeout(300);
  await S.page.screenshot({ path: path.join(OUT, '03-sending.png') });
  await R.page.click('#go-recv');
  await R.page.waitForTimeout(800);
  await R.page.screenshot({ path: path.join(OUT, '04-receiving-empty.png') });
  let p = await pump(S, R, true, 180000);
  ok('Dosya alındı', !(await R.page.isHidden('#v-done')), `${p.fed} kare verildi, ${p.hits} okundu, ${p.ms} ms`);
  const [dl] = await Promise.all([R.page.waitForEvent('download'), R.page.click('#done-actions a')]);
  const got = fs.readFileSync(await dl.path());
  ok('Dosya bit bit aynı, adı korunmuş', dl.suggestedFilename() === 'ölçüm verisi.bin' && got.equals(bin), dl.suggestedFilename() + ', ' + got.length + ' bayt');
  await R.page.screenshot({ path: path.join(OUT, '05-done-file.png') });

  // 2) Fotoğraf, KÜÇÜLT açık: ekran görüntüsünü fotoğraf olarak kullan
  const photo = await S.page.screenshot({ type: 'jpeg', quality: 95, fullPage: true });
  await S.page.click('#stop');
  await S.page.setInputFiles('#pick-photo', { name: 'IMG_0042.jpeg', mimeType: 'image/jpeg', buffer: photo });
  await S.page.waitForSelector('#start:not([disabled])');
  await S.page.screenshot({ path: path.join(OUT, '06-setup-photo.png') });
  const est = await S.page.textContent('#estimate');
  await S.page.click('#start');
  await R.page.click('#again');
  await R.page.waitForTimeout(500);
  p = await pump(S, R, true, 240000);
  ok('Fotoğraf alındı ve önizleme var', await R.page.locator('#done-view img').count() === 1, `${est} | ${p.fed} kare, ${p.ms} ms`);
  ok('Fotoğraf JPEG olarak kaydedildi', (await R.page.textContent('#done-name')) === 'IMG_0042.jpg');
  await R.page.screenshot({ path: path.join(OUT, '07-done-photo.png') });

  // 3) Metin
  await S.page.click('#stop');
  await S.page.locator('#chosen-clear').dispatchEvent('click');
  await S.page.fill('#send-text', 'Toplanma alanı: okul bahçesi, saat 14:00. İlaçları getir; çocuklar iyi.');
  await S.page.waitForSelector('#start:not([disabled])');
  await S.page.click('#start');
  await R.page.click('#again');
  p = await pump(S, R, true, 30000);
  ok('Metin alındı', (await R.page.textContent('#done-view pre')).includes('okul bahçesi'), `${p.fed} kare`);

  // 4) Gönderen yoğunluğu akış sırasında değiştirir: alan baştan başlar ve tamamlar
  await S.page.click('#stop');
  await S.page.fill('#send-text', '');
  await S.page.setInputFiles('#pick-file', { name: 'b.bin', mimeType: 'application/octet-stream', buffer: crypto.randomBytes(20000) });
  await S.page.waitForSelector('#start:not([disabled])');
  await S.page.click('#start');
  await R.page.click('#again');
  await pump(S, R, false, 1500);
  await S.page.click('#v-send .seg[data-pref="density"] button[data-v="kolay"]');
  p = await pump(S, R, true, 180000);
  ok('Yoğunluk değişince yine tamamlanır', !(await R.page.isHidden('#v-done')), `${p.fed} kare`);

  // 5) Rol değişimi: alan telefon gönderen olur, gönderen alan olur, ters yönde aktarım
  await R.page.click('#again');
  await R.page.waitForSelector('#v-recv:not([hidden])');
  await R.page.screenshot({ path: path.join(OUT, '09-recv-swap.png') });
  await R.page.click('#swap-to-send');
  await R.page.waitForSelector('#v-setup:not([hidden])');
  await S.page.click('#swap-to-recv');
  await S.page.waitForSelector('#v-recv:not([hidden])');
  ok('Rol değişimi: kamera kapandı/açıldı doğru ekranlar', !(await S.page.isHidden('#v-recv')) && !(await R.page.isHidden('#v-setup')));
  await R.page.fill('#send-text', 'Ters yönden selam');
  await R.page.waitForSelector('#start:not([disabled])');
  await R.page.click('#start');
  p = await pump(R, S, true, 30000);
  ok('Ters yönde aktarım', (await S.page.textContent('#done-view pre')).includes('Ters yönden'), `${p.fed} kare`);
  await R.page.click('#stop');
  await R.page.click('#v-setup [data-home]');
  await R.page.waitForSelector('#v-home:not([hidden])');

  // 5b) "Bana gönder" kodu: AL → QR GÖSTER, GÖNDER → QR OKUT; akış kendiliğinden başlar
  const feedCanvas = async (from, sel, to) => {
    const url = await from.page.evaluate(s => {
      const src = document.querySelector(s);
      const c = document.createElement('canvas');
      c.width = c.height = src.width * 6;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    }, sel);
    return to.page.evaluate(async u => { const img = new Image(); img.src = u; await img.decode(); return window.qraFeedImage(img); }, url);
  };
  await R.page.click('#go-recv');
  await R.page.click('#show-req');
  await R.page.waitForSelector('#req:not([hidden])');
  await R.page.screenshot({ path: path.join(OUT, '12-recv-show-req.png') });
  await S.page.click('#v-done [data-home]');
  await S.page.click('#go-send');
  await S.page.fill('#send-text', 'Hazır olunca gönderildi');
  await S.page.waitForSelector('#start-scan:not([disabled])');
  await S.page.screenshot({ path: path.join(OUT, '13-setup-two-starts.png') });
  await S.page.click('#start-scan');
  await S.page.waitForSelector('#v-recv.mode-req:not([hidden])');
  await S.page.screenshot({ path: path.join(OUT, '14-send-scan-req.png') });
  ok('GÖNDER → QR OKUT: alıcının kodunu okuyor', await feedCanvas(R, '#req-qr', S));
  ok('Kod okununca akış kendiliğinden başladı', !(await S.page.isHidden('#v-send')));
  await R.page.click('#req-done');
  p = await pump(S, R, true, 30000);
  ok('Akış alıcıya ulaştı', (await R.page.textContent('#done-view pre')).includes('Hazır olunca'), `${p.fed} kare`);
  // AL ekranındaki telefon "bana gönder" kodunu görürse gönderme ekranına geçer
  await S.page.click('#stop');
  await S.page.click('#v-setup [data-home]');
  await S.page.waitForSelector('#v-home:not([hidden])');
  await S.page.click('#go-recv');
  await R.page.click('#again');
  await R.page.click('#show-req');
  await feedCanvas(R, '#req-qr', S);
  ok('AL → QR OKUT: bana gönder kodunu görünce gönderme ekranı açıldı', !(await S.page.isHidden('#v-setup')));
  await S.page.click('#v-setup [data-home]');
  await R.page.click('#req-done');
  await R.page.click('.recv-x');
  await R.page.waitForSelector('#v-home:not([hidden])');
  await S.page.waitForSelector('#v-home:not([hidden])');
  await S.page.click('#go-send');

  // 6) Dil değişimi
  await R.page.click('#v-home [data-lang]');
  ok('İngilizceye geçiyor', (await R.page.textContent('.hero')).startsWith('Two phones') && (await R.page.getAttribute('html', 'lang')) === 'en');
  await R.page.screenshot({ path: path.join(OUT, '10-home-en-dark.png') });
  await S.page.click('#v-setup [data-lang]');
  await S.page.fill('#send-text', 'hello');
  await S.page.waitForSelector('#start:not([disabled])');
  ok('İngilizce süre tahmini', /parts · time/.test(await S.page.textContent('#estimate')));
  await S.page.screenshot({ path: path.join(OUT, '11-setup-en.png') });
  await R.page.click('#v-home [data-lang]');
  ok('Türkçeye geri dönüyor', (await R.page.textContent('.hero')).startsWith('İki telefon'));

  // 7) Gelenler listesi ve çevrimdışı açılış
  const n = await R.page.locator('.item').count();
  ok('Gelenler listesinde 5 öğe', n === 5, String(n));
  await R.page.screenshot({ path: path.join(OUT, '08-home-items-dark.png') });
  const ready = await R.page.waitForFunction(() => document.querySelector('#offline-state').classList.contains('on'), null, { timeout: 15000 }).then(() => true, () => false);
  ok('Çevrimdışı kullanıma hazır', ready);
  await R.ctx.setOffline(true);
  await R.page.reload();
  ok('İnternetsiz yeniden açılıyor, gelenler duruyor', await R.page.waitForFunction(() => document.querySelectorAll('.item').length === 5, null, { timeout: 10000 }).then(() => true, () => false));

  for (const [name, x] of [['gönderen', S], ['alan', R]]) ok('Yatay taşma yok: ' + name, x.overflow.length === 0, x.overflow.join(' | '));
  for (const [name, x] of [['gönderen', S], ['alan', R]]) ok('Konsol hatası yok: ' + name, x.errors.length === 0, x.errors.slice(0, 3).join(' || '));
  await browser.close();
  console.log(fails ? `\n${fails} test başarısız` : '\nTüm testler geçti');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
