-- Translation Memory — stores normalized translation pairs for ML training
-- This data accumulates over sessions and becomes the training dataset
-- for a custom medical translation quality model.

CREATE TABLE IF NOT EXISTS translation_memory (
  id SERIAL PRIMARY KEY,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  back_translation TEXT,
  source_lang VARCHAR(10) NOT NULL,
  target_lang VARCHAR(10) NOT NULL,
  accuracy_score REAL,
  comprehension_score REAL,
  medical_tags JSONB DEFAULT '[]',
  issues JSONB DEFAULT '[]',
  asr_model VARCHAR(100),
  session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  utterance_id INTEGER REFERENCES utterances(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Find translations by language pair (most common query for training data export)
CREATE INDEX idx_tm_langs ON translation_memory(source_lang, target_lang);

-- Filter by quality score (e.g. only train on high-scoring pairs)
CREATE INDEX idx_tm_score ON translation_memory(accuracy_score);

-- Full-text search on source text (future: find similar translations for reuse)
CREATE INDEX idx_tm_source ON translation_memory USING gin(to_tsvector('simple', source_text));
