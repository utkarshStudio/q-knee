import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { router } from './routes';
import { pool } from './db/pool';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Security
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

// CORS Configuration (supports single or comma-separated origins, regex, or wildcard in non-prod)
const rawOrigins = process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploaded images (restricted paths only)
const uploadDir = process.env.UPLOAD_DIR || './storage/uploads';
app.use('/api/static', express.static(path.resolve(uploadDir), { maxAge: '1d' }));

// Root status endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'Q-Knee Backend REST API',
    status: 'online',
    version: '1.0.0',
    health_check: '/health',
    frontend_url: process.env.FRONTEND_URL || 'http://localhost:5173',
    message: 'Welcome to Q-Knee Backend API. Open the web interface at http://localhost:5173'
  });
});

// Routes
app.use('/', router);

// Comprehensive Health Endpoint
app.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    dbStatus = 'fallback_mode';
  }
  res.json({
    status: 'ok',
    service: 'qknee-backend',
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`HQML Backend running on port ${PORT}`);
  console.log(`Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log(`ML Service: ${process.env.ML_SERVICE_URL || 'http://localhost:8000'}`);
});

export default app;
