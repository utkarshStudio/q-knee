import { Router, Response } from 'express';
import axios from 'axios';
import { pool } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [studies, predictions, abnormalPred, experiments, benchmarks, recentStudies, recentPredictions] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM studies WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) FROM predictions p JOIN studies s ON p.study_id = s.id WHERE s.user_id = $1', [userId]),
      pool.query("SELECT COUNT(*) FROM predictions p JOIN studies s ON p.study_id = s.id WHERE s.user_id = $1 AND p.predicted_class = 'abnormal'", [userId]),
      pool.query('SELECT COUNT(*) FROM experiments'),
      pool.query('SELECT COUNT(*) FROM benchmarks'),
      pool.query('SELECT * FROM studies WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5', [userId]),
      pool.query('SELECT p.* FROM predictions p JOIN studies s ON p.study_id = s.id WHERE s.user_id = $1 ORDER BY p.created_at DESC LIMIT 5', [userId]),
    ]);
    res.json({
      totalStudies: parseInt(studies.rows[0].count),
      totalPredictions: parseInt(predictions.rows[0].count),
      abnormalPredictions: parseInt(abnormalPred.rows[0].count),
      totalExperiments: parseInt(experiments.rows[0].count),
      totalBenchmarks: parseInt(benchmarks.rows[0].count),
      recentStudies: recentStudies.rows,
      recentPredictions: recentPredictions.rows,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status', authenticate, async (_req: AuthRequest, res: Response) => {
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
