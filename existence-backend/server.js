const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();

// میدل‌ویرها
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// اتصال به دیتابیس MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB successfully.');
        seedAdmin(); // ایجاد کاربر ادمین اولیه در صورت عدم وجود
    })
    .catch(err => console.error('MongoDB connection error:', err));

// ==========================================
// مدل‌های دیتابیس (Schemas)
// ==========================================

// مدل ادمین
const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const Admin = mongoose.model('Admin', AdminSchema);

// مدل محتوای صفحات (متن و عکس)
const ContentSchema = new mongoose.Schema({
    page: { type: String, required: true },       // نام صفحه مثلا: home, varesh, about
    key: { type: String, required: true, unique: true }, // کلید اختصاصی المان مثلا: hero_title
    type: { type: String, enum: ['text', 'image'], required: true },
    value: { type: String, required: true }       // متن یا آدرس نهایی عکس
});
const Content = mongoose.model('Content', ContentSchema);

// تابع ساخت ادمین اولیه به صورت امن و هش‌شده
async function seedAdmin() {
    const adminExists = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        await Admin.create({ username: process.env.ADMIN_USERNAME, password: hashedPassword });
        console.log('Default admin account created.');
    }
}

// ==========================================
// تنظیمات آپلود فایل با Multer
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const fileExt = path.extname(file.originalname);
        cb(null, `${req.body.key || 'img'}-${Date.now()}${fileExt}`);
    }
});
const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (ext) return cb(null, true);
        cb(new Error('فقط فایل‌های تصویری مجاز هستند.'));
    }
});

// میدل‌ویر تایید توکن ادمین برای امنیت APIهای حساس
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'دسترسی غیرمجاز. توکن یافت نشد.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'توکن منقضی یا نامعتبر است.' });
        req.user = user;
        next();
    });
};

// ==========================================
// مسیرها (API Endpoints)
// ==========================================

// ۱. لاگین ادمین
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin) return res.status(400).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(400).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });

        const token = jwt.sign({ id: admin._id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '12h' });
        res.json({ success: true, token });
    } catch (err) {
        res.status(500).json({ error: 'خطای سرور' });
    }
});

// ۲. دریافت تمام محتوای یک صفحه خاص (عمومی برای فرانت‌ند)
app.get('/api/content/:page', async (req, res) => {
    try {
        const contents = await Content.find({ page: req.params.page });
        res.json(contents);
    } catch (err) {
        res.status(500).json({ error: 'خطا در دریافت اطلاعات' });
    }
});

// ۳. ایجاد یا بروزرسانی متن (مخصوص ادمین)
app.post('/api/admin/text', authenticateAdmin, async (req, res) => {
    const { page, key, value } = req.body;
    try {
        const content = await Content.findOneAndUpdate(
            { key },
            { page, key, type: 'text', value },
            { upsert: true, new: true }
        );
        res.json({ success: true, data: content });
    } catch (err) {
        res.status(500).json({ error: 'خطا در ذخیره متن' });
    }
});

// ۴. آپلود و بروزرسانی عکس (مخصوص ادمین)
app.post('/api/admin/upload', authenticateAdmin, upload.single('image'), async (req, res) => {
    const { page, key } = req.body;
    if (!req.file) return res.status(400).json({ error: 'فایلی ارسال نشده است.' });

    try {
        const imageUrl = `/uploads/${req.file.filename}`;
        const content = await Content.findOneAndUpdate(
            { key },
            { page, key, type: 'image', value: imageUrl },
            { upsert: true, new: true }
        );
        res.json({ success: true, imageUrl: content.value });
    } catch (err) {
        res.status(500).json({ error: 'خطا در آپلود عکس' });
    }
});

// روشن کردن سرور
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running beautifully on port ${PORT}`));