# Interp

**Human-verified AI medical interpretation in emergency departments.**

> Beyond translation, into interpretation.

## Architecture

Built on the Taskwind skeleton (Next.js 16, React 19, Neon PostgreSQL, Vercel).

### Core Flow
```
Physician speaks → ASR → Clean transcript → Translate (medical-grade) → Back-translate → Comprehension score → Patient panel shows translation
Patient speaks   → ASR → Clean transcript → Translate (medical-grade) → Back-translate → Comprehension score → Physician panel shows translation
```

### The Chess Board Layout
Two voice panels side-by-side — physician (blue, left) and patient (orange, right) — with a comprehension score widget in the center. Each panel has its own mic button and scrolling transcript. Utterances appear in real-time on both sides, each in the appropriate language.

### Key Components
- `InterpSession` — Main orchestrator (chess board layout)
- `VoicePanel` — One side of the board (mic + transcript)
- `ComprehensionScore` — Center widget (accuracy + comprehension + escalation)
- `Header` — Session controls

### Key Hooks
- `useSession` — Session lifecycle + utterance management (replaces useTasks)
- `useVoiceRecorder` — Mic recording + ASR pipeline (extracted from QuickCapture)
- `useTranslation` — Translate → back-translate → score pipeline

### AI Pipeline (`src/utils/ai.js`)
- `transcribeAudio()` — ILMU ASR with fallback models
- `processVoiceTranscript()` — Clean ASR output
- `translateMedical()` — Medical-grade translation with back-translation + scoring
- `detectMedicalTags()` — Auto-tag @consent, @allergy, @medication etc.

### What was kept from Taskwind
- Auth system (JWT + bcrypt)
- Neon PostgreSQL connection
- Vercel deployment pipeline
- Voice recording infrastructure (MediaRecorder, format detection, ASR)
- PWA support
- Online/offline detection

### What was stripped
- All task management (useTasks, TaskCard, DailyWins, Pomodoro, etc.)
- Tagging autocomplete UI
- Onboarding tour
- Keyboard shortcuts
- Bottom navigation

## Environment Variables
```
DATABASE_URL=       # Neon PostgreSQL
JWT_SECRET=         # JWT signing key
ILMU_API_KEY=       # ILMU AI API key
```

## Development
```bash
npm install
npm run dev
```

## Patent Pending
Combined AI + Human Interpreter Workflow — Patent Pending.
