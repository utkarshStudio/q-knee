import { Router, Response } from 'express';
import authRoutes from './auth';
import studyRoutes from './studies';
import dashboardRoutes from './dashboard';
import predictionRoutes from './predictions';
import benchmarkRoutes from './benchmarks';
import explanationRoutes from './explanations';
import { pool } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

export const router = Router();

router.use('/api/auth', authRoutes);
router.use('/api/studies', studyRoutes);
router.use('/api/dashboard', dashboardRoutes);
router.use('/api/predictions', predictionRoutes);
router.use('/api/benchmarks', benchmarkRoutes);
router.use('/api/explanations', explanationRoutes);

// Experiments list
router.get('/api/experiments', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM experiments ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
