-- Interp Database Schema (Neon PostgreSQL)
-- Human-verified AI medical interpretation platform

-- Users table (kept from Taskwind)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'physician',
  department VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Interpretation sessions
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_id VARCHAR(100) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  physician_lang VARCHAR(10) NOT NULL DEFAULT 'en',
  patient_lang VARCHAR(10) NOT NULL DEFAULT 'es',
  department VARCHAR(100),
  patient_mrn VARCHAR(100),
  encounter_type VARCHAR(50) DEFAULT 'outpatient',
  avg_comprehension REAL DEFAULT 0,
  avg_accuracy REAL DEFAULT 0,
  escalated_at TIMESTAMPTZ,
  escalation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(user_id, status);

-- Individual utterances within a session
CREATE TABLE IF NOT EXISTS utterances (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT,
  back_translation TEXT,
  source_lang VARCHAR(10) NOT NULL,
  target_lang VARCHAR(10) NOT NULL,
  accuracy_score REAL,
  comprehension_score REAL,
  medical_tags JSONB DEFAULT '[]',
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  audio_url TEXT,
  asr_model VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_utterances_session ON utterances(session_id);
CREATE INDEX idx_utterances_flagged ON utterances(session_id, flagged);

-- Audit log for compliance
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  actor_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_session ON audit_log(session_id);

-- Medical tag definitions
CREATE TABLE IF NOT EXISTS medical_tags (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  severity VARCHAR(20) DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO medical_tags (id, label, color, severity) VALUES
  ('consent', 'Informed Consent', '#3b82f6', 'critical'),
  ('allergy', 'Allergy', '#ef4444', 'critical'),
  ('medication', 'Medication', '#f59e0b', 'warning'),
  ('surgical-risk', 'Surgical Risk', '#ef4444', 'critical'),
  ('diagnosis', 'Diagnosis', '#8b5cf6', 'info'),
  ('symptom', 'Symptom', '#06b6d4', 'info'),
  ('procedure', 'Procedure', '#6366f1', 'warning'),
  ('dosage', 'Dosage', '#f59e0b', 'warning'),
  ('history', 'Medical History', '#64748b', 'info')
ON CONFLICT (id) DO NOTHING;
