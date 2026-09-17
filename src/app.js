require('dotenv').config();
process.env.TZ = process.env.APP_TIMEZONE || "Africa/Cairo";
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const hpp = require("hpp");
const config = require("./config/appConfig");
const http = require('http');
// Middlewares
const requestLogger = require("./middlewares/requestLoggerMW");
const inputSanitizerMW = require("./middlewares/inputSanitizerMW");
const responseStandardizerMW = require("./middlewares/responseStandardizerMW");
const errorHandler = require("./middlewares/errorHandlerMW");
const { defaultLimiter } = require("./middlewares/rateLimiterMW");

// Routes
const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const nurseRoutes = require("./routes/nurseRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const aiRoutes = require("./routes/aiRoutes");
const staffRoutes = require("./routes/staffRoutes");
const nursingServiceRoutes = require('./routes/nursingServiceRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const providerDashboardRoutes = require('./routes/providerDashboardRoutes'); // لوحة تحكم مزودي الخدمة الموحدة
const supportRoutes = require('./routes/supportRoutes');
const { startNotificationWorker } = require('./workers/notificationWorker');

// [جديد] استيراد مهمة التذكير التلقائي للتقييمات
const { initReviewReminderCron } = require('./cron/reviewReminderCron');

const app = express();

if (process.env.REDIS_URL) {
  startNotificationWorker();
}

app.disable("x-powered-by");
if (config.appConfig.trustProxy) app.set("trust proxy", 1);

// Allowed Origins for CORS
const allowedOrigins = Array.from(new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://localhost:5173',
  'https://staff-dashboard-woad.vercel.app',
  ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(',').map(s => s.trim()) : [])
])).filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 204
}));

// Handle preflight OPTIONS requests immediately
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json());
app.use(inputSanitizerMW);
app.use(hpp());
app.use(morgan(config.isProduction ? "combined" : "dev"));
app.use(requestLogger);
app.use(responseStandardizerMW);
app.use(defaultLimiter);

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("🚀 [Database] Connected successfully");
  } catch (err) {
    console.error("❌ [Database] Connection failed:", err.message);
    process.exit(1);
  }
};

// المسارات
app.use("/api/auth", authRoutes);
app.use("/api/login", authRoutes);
app.use("/login", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/nurses", nurseRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/nursing-services", nursingServiceRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/provider-dashboard', providerDashboardRoutes); // ربط مسارات لوحة التحكم
app.use('/api/support', supportRoutes); // مسارات رسائل الدعم الفني

// مسار ترحيبي للصفحة الرئيسية
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Care System API is running successfully! Welcome to the Care System API.",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      doctors: "/api/doctors",
      nurses: "/api/nurses",
      bookings: "/api/bookings",
      ai: "/api/ai",
      staff: "/api/staff",
      nursingServices: "/api/nursing-services",
      providerDashboard: "/api/provider-dashboard"
    },
    data: {}
  });
});
app.use(errorHandler);

// تشغيل السيرفر والاتصال بالقاعدة معاً
const startServer = async () => {
  await connectDB();
  
  // [جديد] تفعيل مهمة الـ Cron Job الخاصة بتذكير التقييمات بمجرد تشغيل السيرفر
  initReviewReminderCron();

  app.listen(config.port, () => {
    console.log(`🚀 Server running on port ${config.port}`);
  });
};

if (require.main === module) {
  startServer();
}

const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 دقائق

setInterval(() => {
  const serverUrl = process.env.EXTERNAL_URL || `http://localhost:${config.port}`;
  
  const client = serverUrl.startsWith('https') ? require('https') : http;
  
  client.get(serverUrl, (res) => {
    console.log(`💡 [Keep-Alive] Self-ping (${serverUrl}) status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`⚠️ [Keep-Alive] Ping error: ${err.message}`);
  });
}, KEEP_ALIVE_INTERVAL);

// Updated doctor and nurse provider clean responses
module.exports = app;