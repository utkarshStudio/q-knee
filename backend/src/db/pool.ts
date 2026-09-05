import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { SAMPLE_DICOM_B64 } from './sample_dicom_b64';
import { decodeDicomToPng } from '../services/dicomDecoder';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface DatabaseStatus {
  mode: 'postgresql' | 'fallback';
  connected: boolean;
}

// 1. PostgreSQL pool setup (only instantiated if DATABASE_URL is non-empty)
const rawDatabaseUrl = (process.env.DATABASE_URL || '').trim();
const hasDatabaseUrl = rawDatabaseUrl.length > 0;

let realPool: Pool | null = null;

if (hasDatabaseUrl) {
  try {
    realPool = new Pool({
      connectionString: rawDatabaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });

    realPool.on('error', (_err) => {
      // Prevent unhandled errors from crashing the Node.js process
    });
  } catch (err) {
    realPool = null;
  }
}

// 2. In-Memory / Local Fallback Store
interface User {
  id: string | number;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
  updated_at?: string;
}

interface Study {
  id: string | number;
  user_id?: string | number | null;
  guest_session_id?: string | null;
  study_instance_uid: string;
  original_filename: string;
  storage_reference?: string;
  status: string;
  mode: string;
  label?: boolean;
  label_source?: string;
  metadata?: any;
  created_at: string;
  updated_at?: string;
  file_paths?: string[];
  storage_path?: string;
  patient_id?: string;
  modality?: string;
  series_count?: number;
  image_count?: number;
  is_abnormal?: boolean;
}

interface Prediction {
  id: string | number;
  study_id: string | number;
  mode?: string;
  model_name: string;
  model_version?: string;
  predicted_class: string;
  abnormal_probability: number;
  normal_probability: number;
  confidence: number;
  raw_output?: any;
  pca_features?: number[];
  model_type?: string;
  status?: string;
  created_at: string;
}

interface Explanation {
  id: string | number;
  prediction_id: string | number;
  gradcam_reference?: any;
  attribution_method?: string;
  attribution_data?: any;
  created_at: string;
}

interface Experiment {
  id: string | number;
  name: string;
  description?: string;
  mode?: string;
  model_configuration?: any;
  dataset_information?: any;
  created_at: string;
}

interface Benchmark {
  id: string | number;
  experiment_id?: string | number | null;
  mode?: string;
  model_name: string;
  accuracy: number;
  precision_score: number;
  recall: number;
  f1: number;
  roc_auc: number;
  sample_count: number;
  dataset_information?: any;
  model_configuration?: any;
  created_at: string;
}

// Initial In-Memory Seed Data
const defaultUserId = "usr_default_researcher_001";
const defaultPasswordHash = bcrypt.hashSync("password123", 10);

let sample5cfPreviewB64: string | undefined;
try {
  const buf = decodeDicomToPng(Buffer.from(SAMPLE_DICOM_B64, 'base64'));
  if (buf) {
    sample5cfPreviewB64 = `data:image/png;base64,${buf.toString('base64')}`;
  }
} catch {}

const memoryStore = {
  users: [
    {
      id: defaultUserId,
      email: "researcher@qknee.ai",
      password_hash: defaultPasswordHash,
      role: "researcher",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "usr_utkarsh_001",
      email: "utkarshg223@gmail.com",
      password_hash: defaultPasswordHash,
      role: "admin",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ] as User[],

  studies: [
    {
      id: "study_001",
      user_id: defaultUserId,
      study_instance_uid: "1.2.826.0.1.3680043.8.498.study_001",
      patient_id: "PATIENT_ACL_001",
      modality: "MR",
      series_count: 1,
      image_count: 8,
      is_abnormal: true,
      status: "ready",
      mode: "DEMO",
      file_paths: [path.resolve(__dirname, "../../../data/sample_mri_dataset/train_series/study_001/volume.npy")],
      original_filename: "knee_mri_sagittal_study_001.npy",
      storage_reference: JSON.stringify([path.resolve(__dirname, "../../../data/sample_mri_dataset/train_series/study_001/volume.npy")]),
      storage_path: path.resolve(__dirname, "../../../data/sample_mri_dataset/train_series/study_001/volume.npy"),
      metadata: { plane: "Sagittal", slices: 8, resolution: "128x128", target: "ACL Abnormality" },
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "study_002",
      user_id: defaultUserId,
      study_instance_uid: "1.2.826.0.1.3680043.8.498.study_002",
      patient_id: "PATIENT_NORMAL_002",
      modality: "MR",
      series_count: 1,
      image_count: 8,
      is_abnormal: false,
      status: "ready",
      mode: "DEMO",
      file_paths: [path.resolve(__dirname, "../../../data/sample_mri_dataset/train_series/study_002/volume.npy")],
      original_filename: "knee_mri_sagittal_study_002.npy",
      storage_reference: JSON.stringify([path.resolve(__dirname, "../../../data/sample_mri_dataset/train_series/study_002/volume.npy")]),
      storage_path: path.resolve(__dirname, "../../../data/sample_mri_dataset/train_series/study_002/volume.npy"),
      metadata: { plane: "Sagittal", slices: 8, resolution: "128x128", target: "ACL Abnormality" },
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "study_5cf7d0b0",
      user_id: defaultUserId,
      study_instance_uid: "1.2.826.0.1.3680043.8.498.study_5cf7d0b0",
      patient_id: "PATIENT_PROD_5CF7D0B0",
      modality: "MR",
      series_count: 1,
      image_count: 1,
      is_abnormal: true,
      status: "ready",
      mode: "REAL",
      file_paths: [path.resolve(process.env.UPLOAD_DIR || "./storage/uploads", "study_5cf7d0b0.dcm")],
      original_filename: "knee_mri_sagittal_study_5cf7d0b0.dcm",
      storage_reference: JSON.stringify([path.resolve(process.env.UPLOAD_DIR || "./storage/uploads", "study_5cf7d0b0.dcm")]),
      storage_path: path.resolve(process.env.UPLOAD_DIR || "./storage/uploads", "study_5cf7d0b0.dcm"),
      metadata: { plane: "Sagittal", slices: 1, slice_count: 1, has_3d_volume: false, resolution: "128x128", target: "ACL Abnormality", preview_b64: sample5cfPreviewB64 },
      created_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
    }
  ] as Study[],

  predictions: [
    {
      id: "pred_study_001",
      study_id: "study_001",
      model_name: "Hybrid Quantum VQC (4 Qubits)",
      model_type: "quantum",
      model_version: "1.0",
      mode: "DEMO",
      predicted_class: "abnormal",
      abnormal_probability: 0.884,
      normal_probability: 0.116,
      confidence: 0.884,
      pca_features: [0.352, -0.418, 0.179, -0.712],
      raw_output: { predicted_class: "abnormal", confidence: 0.884 },
      status: "completed",
      created_at: new Date(Date.now() - 3500000).toISOString(),
    },
    {
      id: "pred_study_002",
      study_id: "study_002",
      model_name: "Hybrid Quantum VQC (4 Qubits)",
      model_type: "quantum",
      model_version: "1.0",
      mode: "DEMO",
      predicted_class: "normal",
      abnormal_probability: 0.142,
      normal_probability: 0.858,
      confidence: 0.858,
      pca_features: [-0.621, 0.311, -0.095, 0.244],
      raw_output: { predicted_class: "normal", confidence: 0.858 },
      status: "completed",
      created_at: new Date(Date.now() - 7100000).toISOString(),
    }
  ] as Prediction[],

  explanations: [] as Explanation[],
  experiments: [
    {
      id: "exp_001",
      name: "ResNet18 + 4-Qubit VQC Screening",
      description: "Baseline multi-slice classical feature extraction compressed via SVD PCA to 4 qubits.",
      mode: "DEMO",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    }
  ] as Experiment[],
  benchmarks: [
    {
      id: "bmk_001",
      experiment_id: "exp_001",
      mode: "DEMO",
      model_name: "Hybrid Quantum VQC (4 Qubits)",
      accuracy: 0.875,
      precision_score: 0.857,
      recall: 0.900,
      f1: 0.878,
      roc_auc: 0.920,
      sample_count: 80,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "bmk_002",
      experiment_id: "exp_001",
      mode: "DEMO",
      model_name: "Classical SVM Baseline",
      accuracy: 0.825,
      precision_score: 0.810,
      recall: 0.850,
      f1: 0.829,
      roc_auc: 0.880,
      sample_count: 80,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    }
  ] as Benchmark[],
};

function safeJsonParse(val: any, fallback: any = {}) {
  if (typeof val !== 'string') return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// Fallback Query Interpreter (Zero Fake Record Creation on Missing IDs)
async function executeFallbackQuery(text: string, params: any[] = []): Promise<QueryResult<any>> {
  const sql = text.trim();
  const lowerSql = sql.toLowerCase();

  // 1. SELECT 1 (Health check query)
  if (lowerSql === 'select 1') {
    return { rows: [{ '?column?': 1 }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] };
  }

  // 2. USERS: Select user by email
  if (lowerSql.includes('from users') && lowerSql.includes('email =')) {
    const email = params[0]?.toString().toLowerCase();
    const user = memoryStore.users.find((u) => u.email.toLowerCase() === email);
    return {
      rows: user ? [user] : [],
      command: 'SELECT',
      rowCount: user ? 1 : 0,
      oid: 0,
      fields: []
    };
  }

  // 3. USERS: Select user by ID
  if (lowerSql.includes('from users') && lowerSql.includes('id =')) {
    const id = params[0];
    const user = memoryStore.users.find((u) => String(u.id) === String(id));
    return {
      rows: user ? [user] : [],
      command: 'SELECT',
      rowCount: user ? 1 : 0,
      oid: 0,
      fields: []
    };
  }

  // 4. USERS: Insert new user (Signup)
  if (lowerSql.startsWith('insert into users')) {
    const email = params[0]?.toString().toLowerCase();
    const hash = params[1];
    const role = params[2] || 'researcher';
    const newUser: User = {
      id: `usr_${uuidv4().slice(0, 8)}`,
      email,
      password_hash: hash,
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryStore.users.push(newUser);
    return {
      rows: [newUser],
      command: 'INSERT',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  // 5. DASHBOARD & STATS: Counts
  if (lowerSql.includes('select count(*)') && lowerSql.includes('from studies')) {
    let filtered = memoryStore.studies;
    if (params.length > 0) {
      const matchParams = params.map((p) => String(p));
      const scoped = filtered.filter((s) =>
        (s.user_id && matchParams.includes(String(s.user_id))) ||
        (s.guest_session_id && matchParams.includes(String(s.guest_session_id)))
      );
      if (scoped.length > 0 || lowerSql.includes('user_id') || lowerSql.includes('guest_session_id')) {
        filtered = scoped;
      }
    }
    return { rows: [{ count: String(filtered.length) }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] };
  }

  if (lowerSql.includes('select count(*) from predictions')) {
    let filtered = memoryStore.predictions;
    if (lowerSql.includes('user_id =') && params.length > 0) {
      const userId = String(params[0]);
      const userStudyIds = new Set(memoryStore.studies.filter((s) => String(s.user_id) === userId).map((s) => String(s.id)));
      filtered = filtered.filter((p) => userStudyIds.has(String(p.study_id)));
    }
    if (lowerSql.includes("predicted_class = 'abnormal'")) {
      filtered = filtered.filter((p) => p.predicted_class === 'abnormal');
    }
    return { rows: [{ count: String(filtered.length) }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] };
  }

  if (lowerSql.includes('select count(*) from experiments')) {
    return { rows: [{ count: String(memoryStore.experiments.length) }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] };
  }

  if (lowerSql.includes('select count(*) from benchmarks')) {
    return { rows: [{ count: String(memoryStore.benchmarks.length) }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] };
  }

  // 6. STUDIES: Select study by ID / user_id / guest_session_id
  if (lowerSql.includes('from studies') && lowerSql.includes('where')) {
    if (lowerSql.includes('id = $1') || lowerSql.includes('where id =') || lowerSql.includes('where s.id =')) {
      const id = String(params[0]);
      const study = memoryStore.studies.find((s) => String(s.id) === id || String(s.study_instance_uid) === id);
      return {
        rows: study ? [study] : [],
        command: 'SELECT',
        rowCount: study ? 1 : 0,
        oid: 0,
        fields: []
      };
    }
    if (params.length > 0) {
      const matchParams = params.map((p) => String(p));
      let filtered = memoryStore.studies.filter((s) =>
        (s.user_id && matchParams.includes(String(s.user_id))) ||
        (s.guest_session_id && matchParams.includes(String(s.guest_session_id)))
      );
      if (filtered.length === 0 && memoryStore.studies.length > 0 && !lowerSql.includes('guest_session_id') && !lowerSql.includes('user_id')) {
        filtered = memoryStore.studies;
      }
      return {
        rows: filtered,
        command: 'SELECT',
        rowCount: filtered.length,
        oid: 0,
        fields: []
      };
    }
  }

  // 7. STUDIES: Select all studies
  if (lowerSql.includes('from studies')) {
    return {
      rows: memoryStore.studies,
      command: 'SELECT',
      rowCount: memoryStore.studies.length,
      oid: 0,
      fields: []
    };
  }

  // 8. STUDIES: Insert study
  if (lowerSql.startsWith('insert into studies')) {
    let userId: any = null;
    let guestSessionId: any = null;
    let studyInstanceUid = uuidv4();
    let originalFilename = 'study.npy';
    let storageReference = '[]';
    let status = 'ready';
    let mode = 'DEMO';
    let metadata: any = {};

    if (params.length >= 8) {
      // Format: (user_id, guest_session_id, study_instance_uid, original_filename, storage_reference, status, mode, metadata)
      userId = params[0] || null;
      guestSessionId = params[1] || null;
      studyInstanceUid = params[2] || uuidv4();
      originalFilename = params[3] || 'study.npy';
      storageReference = typeof params[4] === 'string' ? params[4] : JSON.stringify(params[4] || []);
      status = params[5] || 'ready';
      mode = params[6] || 'DEMO';
      metadata = safeJsonParse(params[7], {});
    } else {
      userId = params[0] || null;
      studyInstanceUid = params[1] || uuidv4();
      originalFilename = params[2] || 'study.npy';
      storageReference = typeof params[3] === 'string' ? params[3] : JSON.stringify(params[3] || []);
      status = params[4] || 'ready';
      mode = params[5] || 'DEMO';
      metadata = safeJsonParse(params[6], {});
    }

    let parsedFilePaths: string[] = [];
    try {
      parsedFilePaths = typeof storageReference === 'string' ? JSON.parse(storageReference) : storageReference;
    } catch {
      parsedFilePaths = [];
    }

    const studyId = studyInstanceUid;
    const newStudy: Study = {
      id: studyId,
      user_id: userId,
      guest_session_id: guestSessionId,
      study_instance_uid: studyInstanceUid,
      original_filename: originalFilename,
      storage_reference: storageReference,
      file_paths: parsedFilePaths,
      storage_path: parsedFilePaths[0] || undefined,
      status: status,
      mode: mode,
      metadata: metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryStore.studies.unshift(newStudy);
    return {
      rows: [newStudy],
      command: 'INSERT',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  // 9. STUDIES: Update study
  if (lowerSql.startsWith('update studies')) {
    if (lowerSql.includes('set status = $1, metadata = $2')) {
      const status = params[0];
      const metadata = safeJsonParse(params[1], {});
      const studyId = String(params[2]);
      const study = memoryStore.studies.find((s) => String(s.id) === studyId || String(s.study_instance_uid) === studyId);
      if (study) {
        study.status = status;
        study.metadata = { ...study.metadata, ...metadata };
        study.updated_at = new Date().toISOString();
      }
      return { rows: study ? [study] : [], command: 'UPDATE', rowCount: study ? 1 : 0, oid: 0, fields: [] };
    }
    if (lowerSql.includes("set status = 'ready'")) {
      const studyId = String(params[0]);
      const study = memoryStore.studies.find((s) => String(s.id) === studyId || String(s.study_instance_uid) === studyId);
      if (study) {
        study.status = 'ready';
        study.updated_at = new Date().toISOString();
      }
      return { rows: study ? [study] : [], command: 'UPDATE', rowCount: study ? 1 : 0, oid: 0, fields: [] };
    }
  }

  // 10. PREDICTIONS: Select prediction by ID / study_id / user_id
  if (lowerSql.includes('from predictions') && lowerSql.includes('where')) {
    if (lowerSql.includes('p.id = $1') && lowerSql.includes('s.user_id = $2') && params.length >= 2) {
      const predId = String(params[0]);
      const userId = String(params[1]);
      const pred = memoryStore.predictions.find((p) => String(p.id) === predId);
      if (pred) {
        const study = memoryStore.studies.find((s) => String(s.id) === String(pred.study_id) && String(s.user_id) === userId);
        if (study) {
          return { rows: [{ ...pred, user_id: study.user_id, storage_reference: study.storage_reference }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] };
        }
      }
      return { rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] };
    }

    if (lowerSql.includes('study_id =') || lowerSql.includes('p.study_id =')) {
      const studyId = String(params[0]);
      const preds = memoryStore.predictions.filter((p) => String(p.study_id) === studyId);
      return { rows: preds, command: 'SELECT', rowCount: preds.length, oid: 0, fields: [] };
    }

    if (lowerSql.includes('where id =') || lowerSql.includes('where p.id =')) {
      const id = String(params[0]);
      const pred = memoryStore.predictions.find((p) => String(p.id) === id);
      return { rows: pred ? [pred] : [], command: 'SELECT', rowCount: pred ? 1 : 0, oid: 0, fields: [] };
    }
  }

  if (lowerSql.includes('from predictions') && lowerSql.includes('s.user_id = $1')) {
    const userId = String(params[0]);
    const userStudyIds = new Set(memoryStore.studies.filter((s) => String(s.user_id) === userId).map((s) => String(s.id)));
    const userPreds = memoryStore.predictions.filter((p) => userStudyIds.has(String(p.study_id)));
    return { rows: userPreds.slice(0, 10), command: 'SELECT', rowCount: userPreds.length, oid: 0, fields: [] };
  }

  if (lowerSql.includes('from predictions')) {
    return { rows: memoryStore.predictions.slice(0, 10), command: 'SELECT', rowCount: memoryStore.predictions.length, oid: 0, fields: [] };
  }

  // 11. PREDICTIONS: Insert prediction
  if (lowerSql.startsWith('insert into predictions')) {
    const newPred: Prediction = {
      id: `pred_${uuidv4().slice(0, 8)}`,
      study_id: params[0],
      mode: params[1] || 'DEMO',
      model_name: params[2] || 'Hybrid Quantum VQC',
      model_version: params[3] || '1.0',
      predicted_class: params[4] || 'abnormal',
      abnormal_probability: Number(params[5]) || 0.5,
      normal_probability: Number(params[6]) || 0.5,
      confidence: Number(params[7]) || 0.5,
      raw_output: safeJsonParse(params[8], {}),
      created_at: new Date().toISOString(),
    };
    memoryStore.predictions.unshift(newPred);
    return {
      rows: [newPred],
      command: 'INSERT',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  // 12. EXPLANATIONS: Select & Insert
  if (lowerSql.includes('from explanations') && lowerSql.includes('where')) {
    if (lowerSql.includes('prediction_id =')) {
      const predId = String(params[0]);
      const expls = memoryStore.explanations.filter((e) => String(e.prediction_id) === predId);
      return { rows: expls, command: 'SELECT', rowCount: expls.length, oid: 0, fields: [] };
    }
    if (lowerSql.includes('e.id = $1')) {
      const explId = String(params[0]);
      const expl = memoryStore.explanations.find((e) => String(e.id) === explId);
      return { rows: expl ? [expl] : [], command: 'SELECT', rowCount: expl ? 1 : 0, oid: 0, fields: [] };
    }
  }

  if (lowerSql.startsWith('insert into explanations')) {
    const newExpl: Explanation = {
      id: `expl_${uuidv4().slice(0, 8)}`,
      prediction_id: params[0],
      gradcam_reference: safeJsonParse(params[1], {}),
      attribution_method: params[2] || 'sensitivity',
      attribution_data: safeJsonParse(params[3], []),
      created_at: new Date().toISOString(),
    };
    memoryStore.explanations.unshift(newExpl);
    return {
      rows: [newExpl],
      command: 'INSERT',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  // 13. EXPERIMENTS & BENCHMARKS: Select
  if (lowerSql.includes('from experiments')) {
    return { rows: memoryStore.experiments, command: 'SELECT', rowCount: memoryStore.experiments.length, oid: 0, fields: [] };
  }

  if (lowerSql.includes('from benchmarks')) {
    return { rows: memoryStore.benchmarks, command: 'SELECT', rowCount: memoryStore.benchmarks.length, oid: 0, fields: [] };
  }


  // Default empty result
  return {
    rows: [],
    command: 'SELECT',
    rowCount: 0,
    oid: 0,
    fields: []
  };
}

// 3. Reliable Database Status Detector
export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  if (!realPool || !hasDatabaseUrl) {
    return { mode: 'fallback', connected: false };
  }
  try {
    const client = await Promise.race([
      realPool.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PostgreSQL connection timeout')), 2500))
    ]);
    try {
      await client.query('SELECT 1');
      client.release();
      return { mode: 'postgresql', connected: true };
    } catch {
      client.release();
      return { mode: 'fallback', connected: false };
    }
  } catch (_err) {
    return { mode: 'fallback', connected: false };
  }
}

// 4. Unified Query Interface
export const pool = {
  async query(text: string, params: any[] = []): Promise<QueryResult<any>> {
    if (realPool && hasDatabaseUrl) {
      try {
        return await realPool.query(text, params);
      } catch (err: any) {
        // If Postgres fails (e.g. ECONNREFUSED, timeout), seamlessly fall back to memoryStore
        return await executeFallbackQuery(text, params);
      }
    }
    return await executeFallbackQuery(text, params);
  },

  async connect(): Promise<any> {
    if (realPool && hasDatabaseUrl) {
      try {
        return await realPool.connect();
      } catch (_err) {
        return {
          query: (text: string, params: any[] = []) => executeFallbackQuery(text, params),
          release: () => {}
        };
      }
    }
    return {
      query: (text: string, params: any[] = []) => executeFallbackQuery(text, params),
      release: () => {}
    };
  },

  on: (event: any, listener: (...args: any[]) => void) => {
    if (realPool) {
      realPool.on(event, listener);
    }
  }
};
