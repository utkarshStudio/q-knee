import { pool } from './pool';

const migrations = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'researcher' CHECK (role IN ('researcher', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS studies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    study_instance_uid VARCHAR(255),
    original_filename VARCHAR(500),
    storage_reference TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'error')),
    mode VARCHAR(20) NOT NULL DEFAULT 'DEMO' CHECK (mode IN ('REAL', 'SIMULATION', 'DEMO')),
    label BOOLEAN,
    label_source VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL DEFAULT 'DEMO' CHECK (mode IN ('REAL', 'SIMULATION', 'DEMO')),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    predicted_class VARCHAR(50),
    abnormal_probability FLOAT,
    normal_probability FLOAT,
    confidence FLOAT,
    raw_output JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS explanations (
    id SERIAL PRIMARY KEY,
    prediction_id INTEGER NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    gradcam_reference JSONB,
    attribution_method VARCHAR(100),
    attribution_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS experiments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mode VARCHAR(20) NOT NULL DEFAULT 'DEMO' CHECK (mode IN ('REAL', 'SIMULATION', 'DEMO')),
    model_configuration JSONB,
    dataset_information JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS benchmarks (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id) ON DELETE SET NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'DEMO' CHECK (mode IN ('REAL', 'SIMULATION', 'DEMO')),
    model_name VARCHAR(100) NOT NULL,
    accuracy FLOAT,
    precision_score FLOAT,
    recall FLOAT,
    f1 FLOAT,
    roc_auc FLOAT,
    sample_count INTEGER,
    dataset_information JSONB,
    model_configuration JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
];

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running HQML database migrations...');
    for (let i = 0; i < migrations.length; i++) {
      console.log(`  Migration ${i + 1}/${migrations.length}...`);
      await client.query(migrations[i]);
    }
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
}
