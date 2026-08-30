import { Router, Response } from 'express';
import { pool } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT p.* FROM predictions p JOIN studies s ON p.study_id = s.id WHERE p.id = $1 AND s.user_id = $2',
      [req.params.id, req.user!.id]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Prediction not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
