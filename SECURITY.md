# 🔒 Güvenlik Kılavuzu

## Mevcut Güvenlik Özellikleri

### ✅ Şu Anda Aktif Olanlar

1. **Şifre Hash'leme (bcrypt)**
   - Admin şifresi bcrypt ile hash'leniyor
   - Veritabanında/kodda açık şifre yok
   - 10 round salt kullanılıyor

2. **Rate Limiting**
   - Login endpoint: 15 dakikada maksimum 5 deneme
   - API endpoint'leri: 1 dakikada maksimum 100 istek
   - Brute force saldırılarına karşı koruma

3. **Session Güvenliği**
   - HttpOnly cookie (XSS koruması)
   - SameSite: strict (CSRF koruması)
   - Secure flag (production'da HTTPS zorunlu)
   - 24 saat oturum süresi

4. **Middleware Koruması**
   - Tüm admin endpoint'leri `requireAuth` ile korumalı
   - Session kontrolü yapılıyor
   - Yetkisiz erişim engelleniyor

5. **Logging**
   - Başarılı/başarısız giriş denemeleri loglanıyor
   - Tarih ve kullanıcı adı kaydediliyor

## 🚀 Canlı Sunucuya Yüklerken

### 1. .env Dosyasını Oluştur

```bash
cp .env.example .env
nano .env
```

**ÖNEMLİ:** Şu değerleri mutlaka değiştir:

```env
ADMIN_USERNAME=yeni-kullanici-adi
ADMIN_PASSWORD=cok-guclu-sifre-123!@#
SESSION_SECRET=rastgele-uzun-bir-deger-buraya
NODE_ENV=production
```

### 2. Güçlü Şifre Oluştur

Şifre en az:
- 12 karakter uzunluğunda
- Büyük ve küçük harf içermeli
- Rakam içermeli
- Özel karakter içermeli (!@#$%^&*)

Örnek: `Ar@sM0t0!2024#Guclu`

### 3. Session Secret Oluştur

Terminal'de çalıştır:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Çıkan değeri SESSION_SECRET'a yapıştır.

### 4. HTTPS Kullan

Production'da mutlaka HTTPS kullan:
- Let's Encrypt ile ücretsiz SSL sertifikası al
- Nginx veya Apache ile reverse proxy kur
- HTTP'den HTTPS'e yönlendirme yap

### 5. Firewall Ayarları

Sadece gerekli portları aç:
```bash
# UFW kullanıyorsan
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH
sudo ufw enable
```

### 6. Düzenli Güncelleme

```bash
npm audit
npm audit fix
npm update
```

## 🛡️ Ek Güvenlik Önerileri

### 1. IP Whitelist (Opsiyonel)

Sadece belirli IP'lerden admin paneline erişim:

```javascript
// server.js'e ekle
const adminIpWhitelist = ['123.456.789.0', '987.654.321.0'];

app.use('/admin', (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    if (adminIpWhitelist.includes(clientIp)) {
        next();
    } else {
        res.status(403).send('Erişim reddedildi');
    }
});
```

### 2. 2FA (İki Faktörlü Doğrulama)

Gelecekte eklenebilir:
- Google Authenticator
- SMS doğrulama
- Email doğrulama

### 3. Backup

Düzenli yedekleme:
```bash
# Ürün veritabanı
cp katalog/products.json backups/products-$(date +%Y%m%d).json

# Görseller
tar -czf backups/uploads-$(date +%Y%m%d).tar.gz katalog/uploads/
```

### 4. Log Monitoring

Şüpheli aktiviteleri takip et:
- Çok fazla başarısız giriş denemesi
- Bilinmeyen IP'lerden erişim
- Anormal API kullanımı

## ⚠️ Güvenlik Kontrol Listesi

Canlıya almadan önce kontrol et:

- [ ] .env dosyası oluşturuldu ve güçlü şifreler girildi
- [ ] .env dosyası .gitignore'da (asla git'e ekleme!)
- [ ] NODE_ENV=production olarak ayarlandı
- [ ] HTTPS aktif
- [ ] Firewall ayarları yapıldı
- [ ] npm paketleri güncellendi
- [ ] Backup sistemi kuruldu
- [ ] Log monitoring aktif

## 🆘 Güvenlik Sorunu Tespit Edersen

1. Hemen sunucuyu kapat
2. Şifreleri değiştir
3. Session'ları temizle
4. Logları incele
5. Gerekirse veritabanını geri yükle

## 📞 İletişim

Güvenlik sorunları için: arasreklam68@gmail.com

---

**Son Güncelleme:** 7 Nisan 2026
