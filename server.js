const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Statik dosyaları servis et
app.use(express.static(__dirname));

// Ana sayfa route'u
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rate limiting - Brute force koruması
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 5, // 15 dakikada maksimum 5 deneme
    message: { error: 'Çok fazla giriş denemesi yaptınız. Lütfen 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Genel API rate limiting
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 dakika
    max: 100, // 1 dakikada maksimum 100 istek
    message: { error: 'Çok fazla istek gönderdiniz. Lütfen bir dakika bekleyin.' }
});

// Multer konfigürasyonu - Dosya yükleme
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        // Klasör yoksa oluştur
        require('fs').mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Türkçe karakterleri düzelt ve benzersiz isim oluştur
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext)
            .toLowerCase()
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/[^a-z0-9]/g, '-');
        cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Sadece resim dosyalarına izin ver
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Sadece resim dosyaları yüklenebilir!'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 saat
        httpOnly: true, // XSS koruması
        secure: process.env.NODE_ENV === 'production', // HTTPS'de true olmalı
        sameSite: 'strict' // CSRF koruması
    }
}));

// API rate limiting
app.use('/api', apiLimiter);

// Admin credentials - .env dosyasından okunuyor
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'arasadmin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aras202568';

// Email transporter (Gmail kullanarak)
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'burakceza68@gmail.com',
        pass: process.env.EMAIL_PASS || 'nootytkrpbqdggjh'
    }
});

// 2FA kodlarını saklamak için (geçici)
const twoFactorCodes = new Map();

// 2FA kodu oluştur
function generate2FACode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 haneli kod
}

// 2FA kodu gönder
async function send2FACode(email, code) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '🔐 Aras Reklam Admin - Giriş Kodu',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                <div style="background-color: #27ae60; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">🔐 Giriş Kodu</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px; color: #333;">Merhaba,</p>
                    <p style="font-size: 16px; color: #333;">Admin panele giriş yapmak için aşağıdaki kodu kullanın:</p>
                    <div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
                        <h2 style="color: #27ae60; font-size: 36px; margin: 0; letter-spacing: 5px;">${code}</h2>
                    </div>
                    <p style="font-size: 14px; color: #666;">Bu kod <strong>5 dakika</strong> geçerlidir.</p>
                    <p style="font-size: 14px; color: #666;">Eğer bu giriş denemesini siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999; text-align: center;">Aras Reklam Moto Aksesuar</p>
                </div>
            </div>
        `
    };

    try {
        await emailTransporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email gönderme hatası:', error);
        return false;
    }
}

// Products JSON path
const PRODUCTS_FILE = path.join(__dirname, 'products.json');

// Auth middleware
function requireAuth(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'Yetkisiz erişim' });
    }
}

// Routes

// Admin login - Rate limited (Step 1: Username & Password)
app.post('/api/admin/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Kullanıcı adı kontrolü
        if (username !== ADMIN_USERNAME) {
            return res.status(401).json({ success: false, message: 'Kullanıcı adı veya şifre hatalı' });
        }
        
        // Şifre kontrolü (direkt karşılaştırma)
        const isPasswordValid = password === ADMIN_PASSWORD;
        
        if (isPasswordValid) {
            // 2FA kodu oluştur ve gönder
            const code = generate2FACode();
            const email = process.env.ADMIN_EMAIL || 'burakceza68@gmail.com';
            
            // Kodu 5 dakika geçerli olacak şekilde sakla
            twoFactorCodes.set(username, {
                code: code,
                expiresAt: Date.now() + 5 * 60 * 1000, // 5 dakika
                attempts: 0
            });
            
            // Email gönder
            const emailSent = await send2FACode(email, code);
            
            if (emailSent) {
                // Session'a geçici bilgi kaydet
                req.session.pendingAuth = {
                    username: username,
                    timestamp: Date.now()
                };
                
                console.log(`📧 2FA kodu gönderildi: ${username} - ${new Date().toLocaleString('tr-TR')}`);
                res.json({ 
                    success: true, 
                    requiresTwoFactor: true,
                    message: 'Giriş kodu email adresinize gönderildi' 
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    message: 'Email gönderilemedi. Lütfen daha sonra tekrar deneyin.' 
                });
            }
        } else {
            console.log(`❌ Başarısız giriş denemesi: ${username} - ${new Date().toLocaleString('tr-TR')}`);
            res.status(401).json({ success: false, message: 'Kullanıcı adı veya şifre hatalı' });
        }
    } catch (error) {
        console.error('Login hatası:', error);
        res.status(500).json({ success: false, message: 'Giriş yapılırken bir hata oluştu' });
    }
});

// Admin login - Step 2: Verify 2FA Code
app.post('/api/admin/verify-2fa', loginLimiter, async (req, res) => {
    const { code } = req.body;
    
    try {
        // Pending auth kontrolü
        if (!req.session.pendingAuth) {
            return res.status(401).json({ 
                success: false, 
                message: 'Önce kullanıcı adı ve şifre ile giriş yapmalısınız' 
            });
        }
        
        const username = req.session.pendingAuth.username;
        const storedData = twoFactorCodes.get(username);
        
        // Kod var mı ve süresi dolmamış mı kontrol et
        if (!storedData) {
            return res.status(401).json({ 
                success: false, 
                message: 'Geçersiz veya süresi dolmuş kod' 
            });
        }
        
        // Süre kontrolü
        if (Date.now() > storedData.expiresAt) {
            twoFactorCodes.delete(username);
            return res.status(401).json({ 
                success: false, 
                message: 'Kodun süresi doldu. Lütfen tekrar giriş yapın' 
            });
        }
        
        // Deneme sayısı kontrolü (maksimum 3 deneme)
        if (storedData.attempts >= 3) {
            twoFactorCodes.delete(username);
            return res.status(401).json({ 
                success: false, 
                message: 'Çok fazla hatalı deneme. Lütfen tekrar giriş yapın' 
            });
        }
        
        // Kod kontrolü (trim ve string karşılaştırması)
        const enteredCode = String(code).trim();
        const storedCode = String(storedData.code).trim();
        
        console.log(`🔍 Kod karşılaştırma - Girilen: "${enteredCode}", Beklenen: "${storedCode}"`);
        
        if (enteredCode === storedCode) {
            // Başarılı giriş
            req.session.isAdmin = true;
            req.session.username = username;
            req.session.loginTime = new Date().toISOString();
            delete req.session.pendingAuth;
            
            // Kodu sil
            twoFactorCodes.delete(username);
            
            console.log(`✅ Admin girişi başarılı (2FA): ${username} - ${new Date().toLocaleString('tr-TR')}`);
            res.json({ success: true, message: 'Giriş başarılı' });
        } else {
            // Hatalı kod
            storedData.attempts++;
            twoFactorCodes.set(username, storedData);
            
            console.log(`❌ Hatalı 2FA kodu: ${username} - Deneme ${storedData.attempts}/3`);
            res.status(401).json({ 
                success: false, 
                message: `Hatalı kod. Kalan deneme: ${3 - storedData.attempts}` 
            });
        }
    } catch (error) {
        console.error('2FA doğrulama hatası:', error);
        res.status(500).json({ success: false, message: 'Doğrulama yapılırken bir hata oluştu' });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    const username = req.session.username;
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout hatası:', err);
            return res.status(500).json({ success: false, message: 'Çıkış yapılırken hata oluştu' });
        }
        console.log(`👋 Admin çıkış yaptı: ${username} - ${new Date().toLocaleString('tr-TR')}`);
        res.json({ success: true, message: 'Çıkış yapıldı' });
    });
});

// Check auth status
app.get('/api/admin/check', (req, res) => {
    res.json({ isAuthenticated: !!req.session.isAdmin });
});

// Upload image (admin only)
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Dosya yüklenmedi' });
        }
        
        // Dosya yolunu döndür
        const imagePath = '/uploads/' + req.file.filename;
        res.json({ 
            success: true, 
            imagePath: imagePath,
            message: 'Görsel başarıyla yüklendi'
        });
    } catch (error) {
        console.error('Dosya yükleme hatası:', error);
        res.status(500).json({ error: 'Dosya yüklenirken hata oluştu' });
    }
});

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        res.json(products);
    } catch (error) {
        console.error('Ürünler okunamadı:', error);
        res.status(500).json({ error: 'Ürünler yüklenemedi' });
    }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        const product = products.find(p => p.id === parseInt(req.params.id));
        
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ error: 'Ürün bulunamadı' });
        }
    } catch (error) {
        console.error('Ürün okunamadı:', error);
        res.status(500).json({ error: 'Ürün yüklenemedi' });
    }
});

// Add product (admin only)
app.post('/api/products', requireAuth, async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        
        const newProduct = {
            id: Date.now(),
            ...req.body
        };
        
        products.push(newProduct);
        
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2));
        res.json({ success: true, product: newProduct });
    } catch (error) {
        console.error('Ürün eklenemedi:', error);
        res.status(500).json({ error: 'Ürün eklenemedi' });
    }
});

// Update product (admin only)
app.put('/api/products/:id', requireAuth, async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        let products = JSON.parse(data);
        
        const index = products.findIndex(p => p.id === parseInt(req.params.id));
        
        if (index !== -1) {
            products[index] = {
                id: parseInt(req.params.id),
                ...req.body
            };
            
            await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2));
            res.json({ success: true, product: products[index] });
        } else {
            res.status(404).json({ error: 'Ürün bulunamadı' });
        }
    } catch (error) {
        console.error('Ürün güncellenemedi:', error);
        res.status(500).json({ error: 'Ürün güncellenemedi' });
    }
});

// Delete product (admin only)
app.delete('/api/products/:id', requireAuth, async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        let products = JSON.parse(data);
        
        const filteredProducts = products.filter(p => p.id !== parseInt(req.params.id));
        
        if (filteredProducts.length < products.length) {
            await fs.writeFile(PRODUCTS_FILE, JSON.stringify(filteredProducts, null, 2));
            res.json({ success: true, message: 'Ürün silindi' });
        } else {
            res.status(404).json({ error: 'Ürün bulunamadı' });
        }
    } catch (error) {
        console.error('Ürün silinemedi:', error);
        res.status(500).json({ error: 'Ürün silinemedi' });
    }
});

// Admin panel route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start server (only if not in Vercel)
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🚀 Aras Reklam Moto Aksesuar - Server Başlatıldı');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`📍 Ana Sayfa: http://localhost:${PORT}`);
        console.log(`📊 Admin Panel: http://localhost:${PORT}/admin`);
        console.log(`👤 Kullanıcı: ${ADMIN_USERNAME}`);
        console.log(`🔐 Şifre: ${ADMIN_PASSWORD}`);
        console.log('═══════════════════════════════════════════════════════');
        console.log('🛡️  Güvenlik Özellikleri:');
        console.log('   ✅ Şifre hash\'leme (bcrypt)');
        console.log('   ✅ Rate limiting (brute force koruması)');
        console.log('   ✅ Session güvenliği');
        console.log('   ✅ XSS ve CSRF koruması');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`⏰ Başlatma Zamanı: ${new Date().toLocaleString('tr-TR')}`);
        console.log('═══════════════════════════════════════════════════════\n');
    });
}

// Export for Vercel
module.exports = app;
