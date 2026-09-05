import { Router, Response } from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { optionalAuthenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function getExplanationStudyOwnership(req: AuthRequest, paramStartIndex = 2): { sql: string; params: any[] } {
  if (req.user?.id) {
    if (req.guestSessionId) {
      return {
        sql: `(s.user_id = $${paramStartIndex} OR (s.user_id IS NULL AND s.guest_session_id = $${paramStartIndex + 1}))`,
        params: [req.user.id, req.guestSessionId]
      };
    }
    return {
      sql: `s.user_id = $${paramStartIndex}`,
      params: [req.user.id]
    };
  }
  return {
    sql: `(s.user_id IS NULL AND s.guest_session_id = $${paramStartIndex})`,
    params: [req.guestSessionId || '']
  };
}

// GET explanation for a prediction
router.get('/:predictionId', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownership = getExplanationStudyOwnership(req, 2);
    const predResult = await pool.query(
      `SELECT p.*, s.user_id, s.guest_session_id FROM predictions p JOIN studies s ON p.study_id = s.id WHERE p.id = $1 AND ${ownership.sql}`,
      [req.params.predictionId, ...ownership.params]
    );
    if (predResult.rows.length === 0) { res.status(404).json({ error: 'Prediction not found' }); return; }
    const prediction = predResult.rows[0];

    const explResult = await pool.query('SELECT * FROM explanations WHERE prediction_id = $1 ORDER BY created_at DESC LIMIT 1', [req.params.predictionId]);
    if (explResult.rows.length === 0) { res.status(404).json({ error: 'No explanation found' }); return; }

    res.json({ prediction, explanation: explResult.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Also handle /api/predictions/:id/explain
router.get('/:predictionId/explain', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownership = getExplanationStudyOwnership(req, 2);
    const predResult = await pool.query(
      `SELECT p.*, s.user_id, s.guest_session_id, s.storage_reference FROM predictions p JOIN studies s ON p.study_id = s.id WHERE p.id = $1 AND ${ownership.sql}`,
      [req.params.predictionId, ...ownership.params]
    );
    if (predResult.rows.length === 0) { res.status(404).json({ error: 'Prediction not found' }); return; }
    const prediction = predResult.rows[0];

    const explResult = await pool.query('SELECT * FROM explanations WHERE prediction_id = $1 ORDER BY created_at DESC LIMIT 1', [req.params.predictionId]);
    if (explResult.rows.length === 0) { res.status(404).json({ error: 'No explanation found' }); return; }

    res.json({ prediction, explanation: explResult.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST generate explanation
router.post('/:predictionId/explain', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownership = getExplanationStudyOwnership(req, 2);
    const predResult = await pool.query(
      `SELECT p.*, s.user_id, s.guest_session_id, s.storage_reference FROM predictions p JOIN studies s ON p.study_id = s.id WHERE p.id = $1 AND ${ownership.sql}`,
      [req.params.predictionId, ...ownership.params]
    );
    if (predResult.rows.length === 0) { res.status(404).json({ error: 'Prediction not found' }); return; }
    const prediction = predResult.rows[0];

    let filePaths: string[] = [];
    try { filePaths = JSON.parse(prediction.storage_reference || '[]'); } catch {}

    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    
    const formExplain = new FormData();
    formExplain.append('prediction_id', prediction.id);
    formExplain.append('study_id', prediction.study_id);
    formExplain.append('model_type', prediction.model_name?.includes('VQC') || prediction.model_name?.includes('Quantum') ? 'quantum' : 'classical');
    for (const p of filePaths) {
      if (fs.existsSync(p)) {
        const fileBytes = fs.readFileSync(p);
        const hash = crypto.createHash('sha256').update(fileBytes).digest('hex');
        console.log(`BACKEND RECEIVED HASH (explain, ${path.basename(p)}): ${hash}`);
        formExplain.append('files', new Blob([fileBytes], { type: 'application/octet-stream' }), path.basename(p));
      }
    }

    const mlRes = await axios.post(`${mlUrl}/explain`, formExplain, { timeout: 120000 });

    const explData = mlRes.data;

    // Store explanation
    const explResult = await pool.query(
      'INSERT INTO explanations (prediction_id, gradcam_reference, attribution_method, attribution_data) VALUES ($1, $2, $3, $4) RETURNING *',
      [prediction.id, JSON.stringify(explData.gradcam || explData.gradcam_reference || {}), explData.attribution_method || 'sensitivity', JSON.stringify(explData.attribution || explData.attribution_data || [])]
    );

    res.json({ prediction, explanation: explResult.rows[0] });
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED') { res.status(503).json({ error: 'ML service unavailable' }); return; }
    res.status(500).json({ error: err?.response?.data?.detail || 'Failed to generate explanation' });
  }
});

// Serve explanation images (local file or proxied from ML microservice)
router.get('/:explanationId/image/:type', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  const { explanationId, type } = req.params;
  try {
    const ownership = getExplanationStudyOwnership(req, 2);
    let explResult = await pool.query(
      `SELECT e.*, p.id as pred_id, s.user_id, s.guest_session_id FROM explanations e JOIN predictions p ON e.prediction_id = p.id JOIN studies s ON p.study_id = s.id WHERE e.id = $1 AND ${ownership.sql}`,
      [explanationId, ...ownership.params]
    );
    if (explResult.rows.length === 0) {
      explResult = await pool.query('SELECT e.*, p.id as pred_id FROM explanations e JOIN predictions p ON e.prediction_id = p.id WHERE e.id = $1', [explanationId]);
    }
    if (explResult.rows.length === 0) { res.status(404).json({ error: 'Explanation not found' }); return; }
    const expl = explResult.rows[0];
    const gradcam = typeof expl.gradcam_reference === 'string' ? JSON.parse(expl.gradcam_reference || '{}') : (expl.gradcam_reference || {});
    const imagePath = gradcam[type];

    if (imagePath && fs.existsSync(imagePath)) {
      res.sendFile(path.resolve(imagePath));
      return;
    }

    // Proxy to ML microservice if not found locally
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    try {
      const mlRes = await axios.get(`${mlUrl}/explanations/${expl.pred_id || expl.prediction_id}/image/${type}`, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(mlRes.data));
      return;
    } catch {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
