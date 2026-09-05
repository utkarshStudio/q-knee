import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { pool } from '../db/pool';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/auth';
import { SAMPLE_DICOM_B64 } from '../db/sample_dicom_b64';
import { decodeDicomToPng, encodeGrayscalePng } from '../services/dicomDecoder';

const router = Router();

function getStudyOwnershipCondition(req: AuthRequest, studyAlias = 'studies', paramStartIndex = 1): { sql: string; params: any[] } {
  if (req.user?.id) {
    if (req.guestSessionId) {
      return {
        sql: `(${studyAlias}.user_id = $${paramStartIndex} OR (${studyAlias}.user_id IS NULL AND ${studyAlias}.guest_session_id = $${paramStartIndex + 1}))`,
        params: [req.user.id, req.guestSessionId]
      };
    }
    return {
      sql: `${studyAlias}.user_id = $${paramStartIndex}`,
      params: [req.user.id]
    };
  }
  return {
    sql: `(${studyAlias}.user_id IS NULL AND ${studyAlias}.guest_session_id = $${paramStartIndex})`,
    params: [req.guestSessionId || '']
  };
}

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

// List studies (for authenticated user or guest session)
router.get('/', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = (req.query.search as string) || '';
  const offset = (page - 1) * limit;
  try {
    const ownership = getStudyOwnershipCondition(req, 's', 1);
    let query = `SELECT s.* FROM studies s WHERE ${ownership.sql}`;
    const params: any[] = [...ownership.params];
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
router.get('/:id', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownership = getStudyOwnershipCondition(req, 'studies', 2);
    let result = await pool.query(`SELECT * FROM studies WHERE id = $1 AND ${ownership.sql}`, [req.params.id, ...ownership.params]);
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
router.get('/:id/slice/:sliceIdx', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownership = getStudyOwnershipCondition(req, 'studies', 2);
    let studyResult = await pool.query(`SELECT * FROM studies WHERE id = $1 AND ${ownership.sql}`, [req.params.id, ...ownership.params]);
    if (studyResult.rows.length === 0) {
      console.warn(`[Diagnostic] Slice preview 404: Study ${req.params.id} not found`);
      res.status(404).json({ error: 'Study not found' });
      return;
    }
    const study = studyResult.rows[0];
    const sliceIdx = Math.max(0, parseInt(req.params.sliceIdx || '0', 10));
    const plane = (typeof req.query.plane === 'string' ? req.query.plane : 'axial').toLowerCase();

    const meta = typeof study.metadata === 'string' ? JSON.parse(study.metadata || '{}') : (study.metadata || {});

    // 1. Check if slice PNG already exists on disk
    const diskPngPath = path.resolve(uploadDir, `${study.id}_slice_${sliceIdx}_${plane}.png`);
    if (fs.existsSync(diskPngPath)) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.sendFile(diskPngPath);
      return;
    }

    // 1b. Check if baseline slice 0 PNG exists
    const fallback0Png = path.resolve(uploadDir, `${study.id}_slice_0.png`);
    if (fs.existsSync(fallback0Png) && (sliceIdx === 0 || !study.has_3d_volume)) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.sendFile(fallback0Png);
      return;
    }

    // 2. Check if metadata has cached base64 preview
    const cachedB64 = (sliceIdx === 0 && meta.preview_b64) ? meta.preview_b64 : meta.slice_previews?.[sliceIdx];
    if (cachedB64) {
      const cleanB64 = cachedB64.includes(',') ? cachedB64.split(',')[1] : cachedB64;
      const pngBuf = Buffer.from(cleanB64, 'base64');
      try { fs.writeFileSync(diskPngPath, pngBuf); } catch {}
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(pngBuf);
      return;
    }

    // 3. Extract file paths associated with the study
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

    // 4. Locate uploaded file on disk
    let targetFilePath = filePaths[sliceIdx] || filePaths[0];

    if (targetFilePath && fs.existsSync(targetFilePath)) {
      const ext = path.extname(targetFilePath).toLowerCase();

      // 4a. Standard 2D image formats (PNG, JPEG, BMP, WebP)
      if (['.png', '.jpg', '.jpeg', '.bmp', '.webp'].includes(ext)) {
        const mimeType = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : `image/${ext.replace('.', '')}`;
        res.set('Content-Type', mimeType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.sendFile(path.resolve(targetFilePath));
        return;
      }

      // 4b. Pure Node DICOM decoding on Backend
      let fileBuf: Buffer | null = null;
      try {
        fileBuf = fs.readFileSync(targetFilePath);
      } catch {}

      if (fileBuf && (ext === '.dcm' || ext === '.dicom')) {
        const isMultiframe = study.has_3d_volume && filePaths.length <= 1;
        const localPng = decodeDicomToPng(fileBuf, isMultiframe ? sliceIdx : 0);
        // If single image or axial or ML service is unavailable, serve local PNG directly
        if (localPng && (!study.has_3d_volume || filePaths.length <= 1 || plane === 'axial')) {
          try { fs.writeFileSync(diskPngPath, localPng); } catch {}
          res.set('Content-Type', 'image/png');
          res.set('Cache-Control', 'public, max-age=86400');
          res.send(localPng);
          return;
        }
      }

      // 4c. Stream multipart to ML service for 3D multi-plane reslicing
      if (fileBuf) {
        try {
          const formData = new FormData();
          const blob = new Blob([fileBuf], { type: 'application/octet-stream' });
          formData.append('file', blob, path.basename(targetFilePath));
          formData.append('slice_idx', String(sliceIdx));
          formData.append('study_id', study.id);
          formData.append('plane', plane);

          const mlRes = await axios.post(`${mlUrl}/preview/slice`, formData, {
            responseType: 'arraybuffer',
            timeout: 10000,
          });

          const pngData = Buffer.from(mlRes.data);
          try { fs.writeFileSync(diskPngPath, pngData); } catch {}
          res.set('Content-Type', 'image/png');
          res.set('Cache-Control', 'public, max-age=86400');
          res.send(pngData);
          return;
        } catch (bufErr: any) {
          console.warn(`[Diagnostic] ML multipart preview error: ${bufErr.message}`);
          // Graceful fallback: If ML fails but we have a DICOM slice, decode directly
          if (ext === '.dcm' || ext === '.dicom') {
            const isMultiframe = study.has_3d_volume && filePaths.length <= 1;
            const localPng = decodeDicomToPng(fileBuf, isMultiframe ? sliceIdx : 0);
            if (localPng) {
              try { fs.writeFileSync(diskPngPath, localPng); } catch {}
              res.set('Content-Type', 'image/png');
              res.set('Cache-Control', 'public, max-age=86400');
              res.send(localPng);
              return;
            }
          }
        }
      }
    }

    // 5. Fallback: try calling /preview/slice with study_id
    try {
      const mlRes = await axios.post(`${mlUrl}/preview/slice`, {
        study_id: study.id,
        slice_idx: sliceIdx,
        plane: plane,
        file_paths: filePaths
      }, { responseType: 'arraybuffer', timeout: 5000 });

      const pngData = Buffer.from(mlRes.data);
      try { fs.writeFileSync(diskPngPath, pngData); } catch {}
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(pngData);
      return;
    } catch (mlErr: any) {
      // Last resort: check if any preview for this study exists on disk
      if (fs.existsSync(fallback0Png)) {
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        res.sendFile(fallback0Png);
        return;
      }
      res.status(422).json({ error: 'Unable to process uploaded MRI volume slice' });
      return;
    }
  } catch (err: any) {
    console.error(`[Diagnostic] Slice preview internal error:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get predictions for a study
router.get('/:id/predictions', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownership = getStudyOwnershipCondition(req, 'studies', 2);
    const study = await pool.query(`SELECT id FROM studies WHERE id = $1 AND ${ownership.sql}`, [req.params.id, ...ownership.params]);
    if (study.rows.length === 0) { res.status(404).json({ error: 'Study not found' }); return; }
    const result = await pool.query('SELECT * FROM predictions WHERE study_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload study (supports authenticated users and guest sessions)
router.post('/upload', optionalAuthenticate, upload.array('files'), async (req: AuthRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) { res.status(400).json({ error: 'No files uploaded' }); return; }
  try {
    const studyId = uuidv4();
    const userId = req.user?.id || null;
    const guestSessionId = !userId ? (req.guestSessionId || uuidv4()) : null;
    const filePaths = files.map(f => f.path);
    const metadata: Record<string, any> = {
      file_count: files.length,
      filenames: files.map(f => f.originalname),
      sizes: files.map(f => f.size),
      slice_count: files.length,
      has_3d_volume: files.length > 3,
    };

    // Determine mode based on file types (DICOM / NPY -> REAL)
    const hasRealMri = files.some(f => {
      const ext = path.extname(f.originalname).toLowerCase();
      return ext === '.dcm' || ext === '.dicom' || ext === '.npy';
    });
    const mode = hasRealMri ? 'REAL' : 'DEMO';

    // Immediately generate and cache PNG preview for slice 0 on the Backend
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    try {
      if (files[0] && fs.existsSync(files[0].path)) {
        const firstFileBuf = fs.readFileSync(files[0].path);
        const directPng = decodeDicomToPng(firstFileBuf);
        if (directPng) {
          const previewPngPath = path.resolve(uploadDir, `${studyId}_slice_0.png`);
          fs.writeFileSync(previewPngPath, directPng);
          metadata.preview_b64 = `data:image/png;base64,${directPng.toString('base64')}`;
          console.log(`[Diagnostic] Generated upload-time preview PNG directly on Backend for study=${studyId}`);
        } else {
          // If not standard DICOM or uncompressed, send multipart to ML service
          const formData = new FormData();
          const blob = new Blob([firstFileBuf], { type: 'application/dicom' });
          formData.append('file', blob, path.basename(files[0].path));
          formData.append('slice_idx', '0');
          formData.append('study_id', studyId);

          const previewRes = await axios.post(`${mlUrl}/preview/slice`, formData, {
            responseType: 'arraybuffer',
            timeout: 15000,
          });

          if (previewRes.data) {
            const previewBuf = Buffer.from(previewRes.data);
            const previewPngPath = path.resolve(uploadDir, `${studyId}_slice_0.png`);
            fs.writeFileSync(previewPngPath, previewBuf);
            metadata.preview_b64 = `data:image/png;base64,${previewBuf.toString('base64')}`;
            console.log(`[Diagnostic] Generated upload-time preview PNG for study=${studyId} via multipart`);
          }
        }
      }
    } catch (prevErr: any) {
      console.warn(`[Diagnostic] Upload preview pre-render note: ${prevErr.message}`);
    }

    // Create study in DB with 'ready' or 'processing' status
    const result = await pool.query(
      `INSERT INTO studies (user_id, guest_session_id, study_instance_uid, original_filename, storage_reference, status, mode, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId, guestSessionId, studyId, files[0].originalname, JSON.stringify(filePaths), 'ready', mode, JSON.stringify(metadata)]
    );
    const study = result.rows[0];

    // Asynchronously notify ML service for deep volume parsing & metrics if needed
    const formProcess = new FormData();
    formProcess.append('study_id', study.id);
    formProcess.append('mode', mode);
    for (const p of filePaths) {
      if (fs.existsSync(p)) {
        const fileBytes = fs.readFileSync(p);
        const hash = crypto.createHash('sha256').update(fileBytes).digest('hex');
        console.log(`BACKEND RECEIVED HASH (process, ${path.basename(p)}): ${hash}`);
        formProcess.append('files', new Blob([fileBytes], { type: 'application/octet-stream' }), path.basename(p));
      }
    }

    axios.post(`${mlUrl}/process`, formProcess, { timeout: 30000 })
      .then(async (mlRes) => {
        const mlData = mlRes.data || {};
        const updatedMeta = { ...metadata, ...mlData };
        await pool.query(
          "UPDATE studies SET status = $1, metadata = $2, updated_at = NOW() WHERE id = $3",
          [mlData.status === 'error' ? 'error' : 'ready', JSON.stringify(updatedMeta), study.id]
        );
      })
      .catch((err) => {
        console.error('ML processing background notification:', err.message);
      });

    res.status(201).json({ study, guest_session_id: guestSessionId });
  } catch (err: any) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Upload processing failed. Please check file format.' });
  }
});

// Run prediction on study
router.post('/:id/predict', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  const { model_type = 'quantum' } = req.body;
  try {
    const ownership = getStudyOwnershipCondition(req, 'studies', 2);
    const studyResult = await pool.query(`SELECT * FROM studies WHERE id = $1 AND ${ownership.sql}`, [req.params.id, ...ownership.params]);
    if (studyResult.rows.length === 0) { res.status(404).json({ error: 'Study not found' }); return; }
    const study = studyResult.rows[0];

    // Get file paths from storage_reference
    let filePaths: string[] = [];
    try {
      filePaths = JSON.parse(study.storage_reference || '[]');
    } catch { filePaths = []; }

    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    
    const formPredict = new FormData();
    formPredict.append('study_id', study.id);
    formPredict.append('model_type', model_type);
    formPredict.append('mode', study.mode);
    for (const p of filePaths) {
      if (fs.existsSync(p)) {
        const fileBytes = fs.readFileSync(p);
        const hash = crypto.createHash('sha256').update(fileBytes).digest('hex');
        console.log(`BACKEND RECEIVED HASH (predict, ${path.basename(p)}): ${hash}`);
        formPredict.append('files', new Blob([fileBytes], { type: 'application/octet-stream' }), path.basename(p));
      }
    }

    const mlRes = await axios.post(`${mlUrl}/predict`, formPredict, { timeout: 120000 });

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
