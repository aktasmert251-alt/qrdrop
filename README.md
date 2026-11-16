# QR Aktar

Ağ, hotspot ya da Bluetooth olmadan dosya, fotoğraf ve metin aktarımı. Gönderen telefonun ekranı hızla değişen QR kodlar gösterir; alan telefon kamerasıyla bu kodları okuyup dosyayı birleştirir. İki cihaz arasında hiçbir bağlantı kurulmaz: veri ışıkla, ekrandan kameraya geçer.

## Kullanım

1. Gönderen **GÖNDER**'e basar, fotoğraf, dosya ya da metin seçer, **BAŞLAT**'a basar.
2. Alan **AL**'a basar ve kamerasını gönderen ekrana 20–30 cm'den tutar.
3. Çubuk %100 olunca dosya alan telefona kaydedilir; gönderen **BİTİR**'e basar.

Kaçan kareler sorun değildir: akış "fountain" kodlamayla üretilir, alan taraf hangi kareleri görürse görsün yeterli sayıda kareden sonra dosyayı çözer. Her kare ve dosyanın bütünü sağlama (CRC32) ile denetlenir.

## Hız

Yaklaşık 2–6 KB/sn. Küçültülmüş bir fotoğraf (≈60–150 KB) 15–60 saniyede gider. Büyük dosyalar için uygun değildir; sınır 8 MB.

| Yoğunluk | Kare başına veri | QR boyutu |
|---|---|---|
| KOLAY | 280 B | sürüm 11 |
| NORMAL | 520 B | sürüm 16 |
| HIZLI | 800 B | sürüm 20 |

## Kurulum

`app/` klasörü HTTPS bir adreste (ör. GitHub Pages) yayınlanır. Telefon adresi internet varken bir kez açıp ana ekrana ekler; sonrasında internetsiz çalışır.

## Yapı

- `app/core.js` — Base45, CRC32, paketleme, LT (fountain) kodlayıcı ve çözücü; tarayıcıda ve Node'da çalışır
- `app/app.js` — arayüz, kamera, QR çizimi ve okuma
- `test/core.test.js` — çekirdek testleri (`node test/core.test.js`)
- `test/e2e.js` — iki sanal telefonla tarayıcı testi
- `tools/serve.js` — bilgisayarda açmak için yerel sunucu

Kullanılan açık kaynak parçalar: qrcode-generator (MIT), jsQR (Apache-2.0), IBM Plex (OFL).
