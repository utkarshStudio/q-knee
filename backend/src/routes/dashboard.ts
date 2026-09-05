import { Router, Response } from 'express';
import axios from 'axios';
import { pool } from '../db/pool';
import { optionalAuthenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/stats', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const guestSessionId = req.guestSessionId;

    let studiesCountPromise: Promise<any>;
    let predCountPromise: Promise<any>;
    let abnormalPredPromise: Promise<any>;
    let recentStudiesPromise: Promise<any>;
    let recentPredPromise: Promise<any>;

    if (userId) {
      studiesCountPromise = pool.query('SELECT COUNT(*) FROM studies WHERE user_id = $1', [userId]);
      predCountPromise = pool.query('SELECT COUNT(*) FROM predictions p JOIN studies s ON p.study_id = s.id WHERE s.user_id = $1', [userId]);
      abnormalPredPromise = pool.query("SELECT COUNT(*) FROM predictions p JOIN studies s ON p.study_id = s.id WHERE s.user_id = $1 AND p.predicted_class = 'abnormal'", [userId]);
      recentStudiesPromise = pool.query('SELECT * FROM studies WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5', [userId]);
      recentPredPromise = pool.query('SELECT p.* FROM predictions p JOIN studies s ON p.study_id = s.id WHERE s.user_id = $1 ORDER BY p.created_at DESC LIMIT 5', [userId]);
    } else if (guestSessionId) {
      studiesCountPromise = pool.query('SELECT COUNT(*) FROM studies WHERE user_id IS NULL AND guest_session_id = $1', [guestSessionId]);
      predCountPromise = pool.query('SELECT COUNT(*) FROM predictions p JOIN studies s ON p.study_id = s.id WHERE s.user_id IS NULL AND s.guest_session_id = $1', [guestSessionId]);
      abnormalPredPromise = pool.query("SELECT COUNT(*) FROM predictions p JOIN studies s ON p.study_id = s.id WHERE s.user_id IS NULL AND s.guest_session_id = $1 AND p.predicted_class = 'abnormal'", [guestSessionId]);
      recentStudiesPromise = pool.query('SELECT * FROM studies WHERE user_id IS NULL AND guest_session_id = $1 ORDER BY created_at DESC LIMIT 5', [guestSessionId]);
      recentPredPromise = pool.query('SELECT p.* FROM predictions p JOIN studies s ON p.study_id = s.id WHERE s.user_id IS NULL AND s.guest_session_id = $1 ORDER BY p.created_at DESC LIMIT 5', [guestSessionId]);
    } else {
      studiesCountPromise = Promise.resolve({ rows: [{ count: '0' }] });
      predCountPromise = Promise.resolve({ rows: [{ count: '0' }] });
      abnormalPredPromise = Promise.resolve({ rows: [{ count: '0' }] });
      recentStudiesPromise = Promise.resolve({ rows: [] });
      recentPredPromise = Promise.resolve({ rows: [] });
    }

    const [studies, predictions, abnormalPred, experiments, benchmarks, recentStudies, recentPredictions] = await Promise.all([
      studiesCountPromise,
      predCountPromise,
      abnormalPredPromise,
      pool.query('SELECT COUNT(*) FROM experiments').catch(() => ({ rows: [{ count: '0' }] })),
      pool.query('SELECT COUNT(*) FROM benchmarks').catch(() => ({ rows: [{ count: '0' }] })),
      recentStudiesPromise,
      recentPredPromise,
    ]);

    res.json({
      totalStudies: parseInt(studies.rows[0]?.count || '0', 10),
      totalPredictions: parseInt(predictions.rows[0]?.count || '0', 10),
      abnormalPredictions: parseInt(abnormalPred.rows[0]?.count || '0', 10),
      totalExperiments: parseInt(experiments.rows[0]?.count || '0', 10),
      totalBenchmarks: parseInt(benchmarks.rows[0]?.count || '0', 10),
      recentStudies: recentStudies.rows || [],
      recentPredictions: recentPredictions.rows || [],
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status', optionalAuthenticate, async (_req: AuthRequest, res: Response) => {
  // Check database
  let dbStatus: 'online' | 'offline' = 'offline';
  try { await pool.query('SELECT 1'); dbStatus = 'online'; } catch {}

  // Check ML service
  let mlStatus: 'online' | 'offline' = 'offline';
  let mlHealth: any = null;
  const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  try {
    const r = await axios.get(`${mlUrl}/health`, { timeout: 3000 });
    mlStatus = 'online';
    mlHealth = r.data;
  } catch {}

  const datasetConfigured = !!(process.env.RSNA_DATA_DIR && process.env.RSNA_DATA_DIR !== '' && process.env.RSNA_DATA_DIR !== '/path/to/rsna/knee/dataset');

  res.json({
    database: dbStatus,
    mlService: mlStatus,
    datasetConfigured,
    currentMode: datasetConfigured ? 'REAL' : 'DEMO',
    mlHealth,
  });
});

export default router;
