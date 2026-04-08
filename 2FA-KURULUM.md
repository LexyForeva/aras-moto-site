# 📧 Email 2FA Kurulum Rehberi

## Adım 1: Nodemailer Paketini Kur

Terminal'de şu komutu çalıştır:

```bash
npm install
```

## Adım 2: Gmail Uygulama Şifresi Oluştur

### Gmail Ayarları:

1. **Gmail hesabına gir**: https://myaccount.google.com/
2. **Güvenlik** sekmesine git
3. **2 Adımlı Doğrulama**'yı aktif et (eğer aktif değilse)
4. **Uygulama şifreleri** bölümüne git
5. **Uygulama seç** → "Mail" seç
6. **Cihaz seç** → "Diğer" seç, "Aras Reklam Admin" yaz
7. **Oluştur** butonuna tıkla
8. **16 haneli şifreyi kopyala** (örnek: `abcd efgh ijkl mnop`)

## Adım 3: .env Dosyasını Güncelle

`.env` dosyasını aç ve şu satırları düzenle:

```env
# Email Configuration (2FA için)
ADMIN_EMAIL=arasreklam68@gmail.com
EMAIL_USER=arasreklam68@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

**ÖNEMLİ:** 
- `EMAIL_PASS` kısmına Gmail'den aldığın 16 haneli uygulama şifresini yapıştır
- Boşlukları kaldırabilirsin: `abcdefghijklmnop`
- Normal Gmail şifreni KULLANMA, uygulama şifresi olmalı!

## Adım 4: Serveri Yeniden Başlat

Terminal'de:

```bash
npm start
```

## Nasıl Çalışır?

### 1. Admin Panele Giriş:
```
http://localhost:3000/admin
```

### 2. Kullanıcı Adı ve Şifre Gir:
- Kullanıcı Adı: `arasadmin`
- Şifre: `aras2024!`

### 3. Email'e Kod Gelir:
- 6 haneli kod `arasreklam68@gmail.com` adresine gelir
- Kod 5 dakika geçerlidir
- Maksimum 3 deneme hakkın var

### 4. Kodu Gir:
- Email'den gelen 6 haneli kodu gir
- Doğru kod girersen admin panele girersin

## Güvenlik Özellikleri:

✅ **2 Katmanlı Güvenlik**: Şifre + Email kodu
✅ **Zaman Sınırı**: Kod 5 dakika geçerli
✅ **Deneme Sınırı**: Maksimum 3 yanlış deneme
✅ **Rate Limiting**: 15 dakikada 5 giriş denemesi
✅ **Şifreli Saklama**: Şifreler bcrypt ile hash'leniyor

## Sorun Giderme:

### Email Gelmiyor?
1. Gmail uygulama şifresini doğru kopyaladın mı?
2. 2 Adımlı Doğrulama aktif mi?
3. Spam klasörünü kontrol et
4. `.env` dosyasında email adresi doğru mu?

### "Email gönderilemedi" Hatası?
1. İnternet bağlantını kontrol et
2. Gmail uygulama şifresini yeniden oluştur
3. `.env` dosyasını kontrol et
4. Serveri yeniden başlat

### Kod Çalışmıyor?
1. Kodun süresi dolmuş olabilir (5 dakika)
2. 3 yanlış denemeden sonra yeni kod istemen gerekir
3. Tekrar giriş yap, yeni kod gelecek

## Test Et:

1. Serveri başlat: `npm start`
2. Tarayıcıda aç: `http://localhost:3000/admin`
3. Kullanıcı adı ve şifre gir
4. Email'i kontrol et
5. 6 haneli kodu gir
6. Admin panele gir!

## Canlıya Alırken:

Siteyi yayınlarken `.env` dosyasını sunucuya yükle ve şunları güncelle:

```env
NODE_ENV=production
EMAIL_USER=arasreklam68@gmail.com
EMAIL_PASS=your-gmail-app-password
ADMIN_EMAIL=arasreklam68@gmail.com
```

---

**Sorular?** Herhangi bir sorun olursa bana sor! 🚀
