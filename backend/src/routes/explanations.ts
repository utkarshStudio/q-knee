import { Router, Response } from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { pool } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET explanation for a prediction
router.get('/:predictionId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Check ownership
    const predResult = await pool.query(
      'SELECT p.*, s.user_id FROM predictions p JOIN studies s ON p.study_id = s.id WHERE p.id = $1 AND s.user_id = $2',
      [req.params.predictionId, req.user!.id]
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
router.get('/:predictionId/explain', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const predResult = await pool.query(
      'SELECT p.*, s.user_id, s.storage_reference FROM predictions p JOIN studies s ON p.study_id = s.id WHERE p.id = $1 AND s.user_id = $2',
      [req.params.predictionId, req.user!.id]
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
router.post('/:predictionId/explain', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const predResult = await pool.query(
      'SELECT p.*, s.user_id, s.storage_reference FROM predictions p JOIN studies s ON p.study_id = s.id WHERE p.id = $1 AND s.user_id = $2',
      [req.params.predictionId, req.user!.id]
    );
    if (predResult.rows.length === 0) { res.status(404).json({ error: 'Prediction not found' }); return; }
    const prediction = predResult.rows[0];

    let filePaths: string[] = [];
    try { filePaths = JSON.parse(prediction.storage_reference || '[]'); } catch {}

    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    const mlRes = await axios.post(`${mlUrl}/explain`, {
      prediction_id: prediction.id,
      study_id: prediction.study_id,
      file_paths: filePaths,
      model_type: prediction.model_name?.includes('VQC') || prediction.model_name?.includes('Quantum') ? 'quantum' : 'classical',
    }, { timeout: 120000 });

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

// Serve explanation images
router.get('/:explanationId/image/:type', authenticate, async (req: AuthRequest, res: Response) => {
  const { explanationId, type } = req.params;
  try {
    const explResult = await pool.query(
      'SELECT e.*, p.id as pred_id, s.user_id FROM explanations e JOIN predictions p ON e.prediction_id = p.id JOIN studies s ON p.study_id = s.id WHERE e.id = $1 AND s.user_id = $2',
      [explanationId, req.user!.id]
    );
    if (explResult.rows.length === 0) { res.status(404).json({ error: 'Explanation not found' }); return; }
    const expl = explResult.rows[0];
    const gradcam = expl.gradcam_reference || {};
    const imagePath = gradcam[type];
    if (!imagePath || !fs.existsSync(imagePath)) { res.status(404).json({ error: 'Image not found' }); return; }
    res.sendFile(path.resolve(imagePath));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
