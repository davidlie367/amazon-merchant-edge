import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import rateLimit from 'express-rate-limit';
import { initializeWebSocket } from './services/wsService.js';

// Import routers using NodeNext resolution (.js suffix is required for moduleResolution: NodeNext)
import authRouter from './routes/auth.js';
import transactionsRouter from './routes/transactions.js';
import reviewsRouter from './routes/reviews.js';
import chatRouter from './routes/chat.js';
import adminRouter from './routes/admin.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL ERROR: JWT_SECRET environment variable is not defined in production mode. Terminating process...');
    process.exit(1);
  } else {
    console.warn('⚠️ WARNING: JWT_SECRET environment variable is not defined. Falling back to default secret (UNSECURE).');
  }
}

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Render load balancer/Cloudflare) to enable rate-limiting tracking

import helmet from 'helmet';

const PORT = process.env.PORT || 5000;

// Rate limiting middleware to prevent brute-force attacks and optimize throughput
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable all internal validations to prevent load-balancer/proxy error crashes
  message: { error: 'Too many requests, rate limit exceeded.' }
});

// Stricter rate limiter specifically for security-sensitive authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 authentication requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable validations to ensure stable proxy routing
  message: { error: 'Too many login or registration attempts from this IP. Please try again after 15 minutes.' }
});

// Enable Helmet security headers with Content-Security-Policy (CSP) configured
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "wss:", "ws:", "https:", "http:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  }
}));

// Configure production-ready CORS (read from FRONTEND_URL environment variable or fallback to localhost dev ports)
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin, allowed origins list, or Render backend domains
    if (!origin || allowedOrigins.includes(origin) || origin.includes('onrender.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api', apiLimiter);

// Serve static admin files and uploads folder statically
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.get('/super-admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/super.html'));
});
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Global API Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Amazon Vine Review Evaluation Backend' });
});

// Router mounts
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/admin/login', authLimiter);
app.use('/api/auth/admin/register', authLimiter);
app.use('/api/auth/super/login', authLimiter);

app.use('/api/auth', authRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);

// Wrap app inside HTTP Server to attach WebSocket listener on the same port
const server = http.createServer(app);
initializeWebSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
export default app;
