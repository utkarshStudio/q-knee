import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { pool } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Set up multer storage OUTSIDE git-tracked source
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024, files: 500 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.dcm', '.dicom', '.npy', '.jpg', '.jpeg', '.png', '.bmp', '.tiff'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype.startsWith('image/') || file.mimetype === 'application/dicom' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${ext}. Supported: DICOM (.dcm), NPY (.npy), PNG/JPEG.`));
    }
  },
});

// List studies for authenticated user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = (req.query.search as string) || '';
  const offset = (page - 1) * limit;
  try {
    let query = 'SELECT s.* FROM studies s WHERE s.user_id = $1';
    const params: any[] = [req.user!.id];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (s.original_filename ILIKE $${params.length} OR s.study_instance_uid ILIKE $${params.length})`;
    }
    const countQ = query.replace('SELECT s.*', 'SELECT COUNT(*)');
    const [dataRes, countRes] = await Promise.all([
      pool.query(query + ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
      pool.query(countQ, params),
    ]);
    res.json({ studies: dataRes.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error('Studies list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get study by ID with accurate slice count & metadata
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let result = await pool.query('SELECT * FROM studies WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    if (result.rows.length === 0) {
      result = await pool.query('SELECT * FROM studies WHERE id = $1', [req.params.id]);
    }
    if (result.rows.length === 0) { res.status(404).json({ error: 'Study not found' }); return; }
    const study = result.rows[0];
    const meta = typeof study.metadata === 'string' ? JSON.parse(study.metadata || '{}') : (study.metadata || {});
    let filePaths: string[] = [];
    try {
      filePaths = typeof study.storage_reference === 'string' ? JSON.parse(study.storage_reference || '[]') : (study.storage_reference || []);
    } catch { filePaths = []; }

    const sliceCount = meta.slice_count !== undefined ? meta.slice_count : (filePaths.length > 0 ? filePaths.length : (study.image_count || 1));
    const has3dVolume = meta.has_3d_volume !== undefined ? meta.has_3d_volume : (sliceCount > 3);

    res.json({
      ...study,
      metadata: meta,
      slice_count: sliceCount,
      has_3d_volume: has3dVolume,
      preview_url: `/api/studies/${study.id}/slice/0`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stream DICOM / NPY / Image slice preview as PNG
router.get('/:id/slice/:sliceIdx', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let studyResult = await pool.query('SELECT * FROM studies WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    if (studyResult.rows.length === 0) {
      studyResult = await pool.query('SELECT * FROM studies WHERE id = $1', [req.params.id]);
    }
    if (studyResult.rows.length === 0) { res.status(404).json({ error: 'Study not found' }); return; }
    const study = studyResult.rows[0];

    const sliceIdx = parseInt(req.params.sliceIdx || '0', 10);
    let filePaths: string[] = [];
    try {
      filePaths = typeof study.storage_reference === 'string' ? JSON.parse(study.storage_reference || '[]') : (study.storage_reference || []);
    } catch { filePaths = []; }
    if (filePaths.length === 0 && study.file_paths) {
      filePaths = study.file_paths;
    }
    if (filePaths.length === 0 && study.storage_path) {
      filePaths = [study.storage_path];
    }

    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

    if (filePaths.length > 0) {
      try {
        const mlRes = await axios.post(`${mlUrl}/preview/slice`, {
          study_id: study.id,
          file_paths: filePaths,
          slice_idx: sliceIdx,
        }, { responseType: 'arraybuffer', timeout: 30000 });

        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(mlRes.data));
        return;
      } catch (mlErr: any) {
        // Fallback to sample preview if ML preview failed
      }
    }

    try {
      const sampleRes = await axios.get(`${mlUrl}/preview/sample/${study.id}/${sliceIdx}`, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(sampleRes.data));
      return;
    } catch {
      res.status(404).json({ error: 'Slice image unavailable' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get predictions for a study
router.get('/:id/predictions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Verify ownership
    const study = await pool.query('SELECT id FROM studies WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    if (study.rows.length === 0) { res.status(404).json({ error: 'Study not found' }); return; }
    const result = await pool.query('SELECT * FROM predictions WHERE study_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload study
router.post('/upload', authenticate, upload.array('files'), async (req: AuthRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) { res.status(400).json({ error: 'No files uploaded' }); return; }
  try {
    const studyId = uuidv4();
    const filePaths = files.map(f => f.path);
    const metadata: Record<string, any> = {
      file_count: files.length,
      filenames: files.map(f => f.originalname),
      sizes: files.map(f => f.size),
    };

    // Determine mode based on file types (DICOM / NPY -> REAL)
    const hasRealMri = files.some(f => {
      const ext = path.extname(f.originalname).toLowerCase();
      return ext === '.dcm' || ext === '.dicom' || ext === '.npy';
    });
    const mode = hasRealMri ? 'REAL' : 'DEMO';

    // Create study in DB with 'processing' status
    const result = await pool.query(
      `INSERT INTO studies (user_id, study_instance_uid, original_filename, storage_reference, status, mode, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user!.id, studyId, files[0].originalname, JSON.stringify(filePaths), 'processing', mode, JSON.stringify(metadata)]
    );
    const study = result.rows[0];

    // Process with ML service (single source of truth for volume parsing & validation)
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    axios.post(`${mlUrl}/process`, { study_id: study.id, file_paths: filePaths, mode }, { timeout: 30000 })
      .then(async (mlRes) => {
        const mlData = mlRes.data || {};
        const updatedMeta = { ...metadata, ...mlData };
        await pool.query(
          "UPDATE studies SET status = $1, metadata = $2, updated_at = NOW() WHERE id = $3",
          [mlData.status === 'error' ? 'error' : 'ready', JSON.stringify(updatedMeta), study.id]
        );
      })
      .catch(async (err) => {
        console.error('ML processing notification:', err.message);
        await pool.query("UPDATE studies SET status = 'ready', updated_at = NOW() WHERE id = $1", [study.id]);
      });

    res.status(201).json({ study });
  } catch (err: any) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Upload processing failed. Please check file format.' });
  }
});

// Run prediction on study
router.post('/:id/predict', authenticate, async (req: AuthRequest, res: Response) => {
  const { model_type = 'quantum' } = req.body;
  try {
    const studyResult = await pool.query('SELECT * FROM studies WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    if (studyResult.rows.length === 0) { res.status(404).json({ error: 'Study not found' }); return; }
    const study = studyResult.rows[0];

    // Get file paths from storage_reference
    let filePaths: string[] = [];
    try {
      filePaths = JSON.parse(study.storage_reference || '[]');
    } catch { filePaths = []; }

    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    const mlRes = await axios.post(`${mlUrl}/predict`, {
      study_id: study.id,
      file_paths: filePaths,
      model_type,
      mode: study.mode,
    }, { timeout: 120000 });

    const mlData = mlRes.data;

    // Store prediction
    const predResult = await pool.query(
      `INSERT INTO predictions (study_id, mode, model_name, model_version, predicted_class, abnormal_probability, normal_probability, confidence, raw_output)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        study.id, mlData.mode || study.mode,
        mlData.model_name || (model_type === 'quantum' ? 'HybridVQC' : 'ClassicalSVM'),
        mlData.model_version || '1.0',
        mlData.predicted_class,
        mlData.abnormal_probability,
        mlData.normal_probability,
        mlData.confidence,
        JSON.stringify(mlData),
      ]
    );
    res.json({ prediction: predResult.rows[0] });
  } catch (err: any) {
    console.error('Prediction error:', err.message);
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      res.status(503).json({ error: 'ML service unavailable. Please ensure the ML service is running.' });
    } else {
      res.status(500).json({ error: err?.response?.data?.detail || 'Prediction failed' });
    }
  }
});

export default router;
