# QRDrop

**English** · [Türkçe](#türkçe)

Send files, photos and text between two phones with **no network at all** — no Wi‑Fi, no hotspot, no Bluetooth, no internet. The sending phone shows a fast stream of QR codes; the receiving phone reads them with its camera and rebuilds the file. Data travels as light, from screen to camera.

**Live:** https://aktasmert251-alt.github.io/qrdrop/ · Interface in English and Turkish.

## How to use

1. Sender taps **SEND**, picks a photo, file or text, and taps **START**.
2. Receiver taps **RECEIVE** and holds the camera 20–30 cm from the sending screen.
3. At 100% the file is saved on the receiving phone; the sender taps **FINISH**.

Both sides can **show** or **scan** a QR:

| | SHOW QR | SCAN QR |
|---|---|---|
| **SEND** | Starts the code stream right away | Scans the receiver's “send to me” code; the stream starts automatically |
| **RECEIVE** | Shows a “send to me” code (the other phone can also scan it with its normal camera to open QRDrop's send screen) | Reads the code stream with the camera |

Either phone can also switch roles at any time with **⇄ SWAP ROLES**, so whichever phone has the better camera can be the receiver.

Missed frames don't matter: the stream uses fountain (LT) coding, so the receiver can rebuild the file from any large enough set of frames, even if it starts late. The whole file is checked with CRC32.

## Speed

About 2–6 KB/s. A shrunk photo (≈60–150 KB) takes 15–60 seconds. Not meant for large files; the limit is 8 MB.

| Density | Data per frame | QR version |
|---|---|---|
| EASY | 280 B | 11 |
| NORMAL | 520 B | 16 |
| FAST | 800 B | 20 |

## Install

Open the live address once while online and add it to the home screen (Android: Chrome → Install app; iPhone: Safari → Share → Add to Home Screen). After that it works fully offline.

---

## Türkçe

İki telefon arasında **hiçbir ağ olmadan** dosya, fotoğraf ve metin gönderin: Wi‑Fi, hotspot, Bluetooth ya da internet gerekmez. Gönderen telefon ekranında hızla değişen QR kodlar gösterir; alan telefon kamerasıyla bunları okuyup dosyayı birleştirir. Veri ışıkla, ekrandan kameraya geçer.

**Adres:** https://aktasmert251-alt.github.io/qrdrop/ · Arayüz Türkçe ve İngilizce.

### Kullanım

1. Gönderen **GÖNDER**'e basar, fotoğraf, dosya ya da metin seçer, **BAŞLAT**'a basar.
2. Alan **AL**'a basar ve kamerasını gönderen ekrana 20–30 cm'den tutar.
3. Çubuk %100 olunca dosya alan telefona kaydedilir; gönderen **BİTİR**'e basar.

İki tarafta da hem **QR göster** hem **QR okut** seçeneği var:

| | QR GÖSTER | QR OKUT |
|---|---|---|
| **GÖNDER** | Kod akışı hemen başlar | Alıcının “bana gönder” kodunu okutur; akış kendiliğinden başlar |
| **AL** | “Bana gönder” kodu gösterir (karşı telefon normal kamerasıyla okutsa da QRDrop'un gönderme ekranı açılır) | Kamera kod akışını okur |

İki telefon da **⇄ ROLÜ DEĞİŞ** ile istediği an rol değiştirebilir; kamerası iyi olan telefon alıcı olur.

Kaçan kareler sorun değildir: akış "fountain" (LT) kodlamayla üretilir, alan taraf geç başlasa bile yeterli sayıda kareden dosyayı çözer. Dosyanın bütünü CRC32 ile denetlenir.

### Hız

Yaklaşık 2–6 KB/sn. Küçültülmüş bir fotoğraf (≈60–150 KB) 15–60 saniyede gider. Büyük dosyalar için uygun değildir; sınır 8 MB.

### Kurulum

Adresi internet varken bir kez açıp ana ekrana ekleyin (Android: Chrome → Uygulamayı yükle; iPhone: Safari → Paylaş → Ana Ekrana Ekle). Sonrasında tamamen internetsiz çalışır.

---

## Project layout / Yapı

- `app/core.js` — Base45, CRC32, packing, LT encoder/decoder (browser + Node)
- `app/app.js` — UI, camera, QR drawing and reading
- `app/i18n.js` — English and Turkish strings
- `test/core.test.js` — core tests (`node test/core.test.js`)
- `test/e2e.js` — two-phone browser test (Playwright)
- `tools/serve.js` — local server for desktop use

Open-source parts: qrcode-generator (MIT), jsQR (Apache-2.0), IBM Plex (OFL).
