import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { router } from './routes';
import { pool, getDatabaseStatus } from './db/pool';
import { runMigrations } from './db/migrate';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = parseInt(process.env.PORT || process.env.BACKEND_PORT || '3001', 10);

// Security Headers
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));

// Production CORS Configuration (Strict origins, no wildcard with credentials)
const defaultAllowedOrigins = [
  'https://q-knee.vercel.app',
  'https://qknee.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
];

const envFrontendUrl = process.env.FRONTEND_URL || '';
const envAllowedOrigins = process.env.ALLOWED_ORIGINS || '';
const rawOrigins = [envFrontendUrl, envAllowedOrigins].filter(Boolean).join(',');
const configuredOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
const allowedOriginsSet = new Set([...defaultAllowedOrigins, ...configuredOrigins]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    // Check exact matches
    if (allowedOriginsSet.has(origin)) {
      return callback(null, true);
    }
    // Check Vercel preview deployments safely
    if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    // Allow localhost in development
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Session-ID', 'x-guest-session-id'],
  exposedHeaders: ['X-Guest-Session-ID'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploaded images
const uploadDir = process.env.UPLOAD_DIR || './storage/uploads';
app.use('/api/static', express.static(path.resolve(uploadDir), { maxAge: '1d' }));

// Root status endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'Q-Knee Backend REST API',
    status: 'online',
    version: '1.0.0',
    health_check: '/health',
    db_diagnostic: '/api/health/db',
    frontend_url: process.env.FRONTEND_URL || 'https://q-knee.vercel.app',
    message: 'Welcome to Q-Knee Backend API.'
  });
});

// Primary Health Check (Standardized specification)
app.get('/health', async (_req, res) => {
  const dbStatus = await getDatabaseStatus();
  res.json({
    status: 'ok',
    service: 'qknee-api',
    database: {
      mode: dbStatus.mode,
      connected: dbStatus.connected,
    },
  });
});

// Safe Database Diagnostic Endpoint
app.get('/api/health/db', async (_req, res) => {
  const dbStatus = await getDatabaseStatus();
  let select1Result: number | null = null;
  if (dbStatus.connected) {
    try {
      const qRes = await pool.query('SELECT 1');
      if (qRes.rows && qRes.rows.length > 0) {
        select1Result = 1;
      }
    } catch {
      select1Result = null;
    }
  }
  res.json({
    status: 'ok',
    database: {
      mode: dbStatus.mode,
      connected: dbStatus.connected,
    },
    select_1: select1Result,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/', router);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HQML Backend running on 0.0.0.0:${PORT}`);
  console.log(`Allowed Origins: ${Array.from(allowedOriginsSet).join(', ')}`);
  console.log(`ML Service: ${process.env.ML_SERVICE_URL || 'http://localhost:8000'}`);

  runMigrations().then(() => {
    console.log('Database migrations applied successfully.');
  }).catch((err) => {
    console.warn('Notice: PostgreSQL migrations skipped or offline (operating in fallback/resilient mode):', err?.message || err);
  });
});

export default app;
