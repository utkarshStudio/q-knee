import { Router, Response } from 'express';
import { pool } from '../db/pool';
import { optionalAuthenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/:id', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    let ownershipSql = 's.user_id IS NULL AND s.guest_session_id = $2';
    let params: any[] = [req.params.id, req.guestSessionId || ''];
    if (req.user?.id) {
      if (req.guestSessionId) {
        ownershipSql = '(s.user_id = $2 OR (s.user_id IS NULL AND s.guest_session_id = $3))';
        params = [req.params.id, req.user.id, req.guestSessionId];
      } else {
        ownershipSql = 's.user_id = $2';
        params = [req.params.id, req.user.id];
      }
    }
    const result = await pool.query(
      `SELECT p.* FROM predictions p JOIN studies s ON p.study_id = s.id WHERE p.id = $1 AND ${ownershipSql}`,
      params
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Prediction not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
