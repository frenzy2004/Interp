# Interp

**Human-verified AI medical interpretation in emergency departments.**

> Beyond translation, into interpretation.

Built with Next.js 16, React 19, Google Gemini AI, Neon PostgreSQL, and deployed on Vercel.

---

## System Architecture

```mermaid
graph LR
  subgraph client [Browser]
    InterpSession["InterpSession"]
    VPDoc["VoicePanel\nPhysician"]
    VPPat["VoicePanel\nPatient"]
    CompScore["ComprehensionScore"]
    OtherUI["Header, AuthModal, DemoMode,\nAuditLog, InterpreterDashboard"]
    Hooks["useSession, useTranslation,\nuseVoiceRecorder, useComprehensionCheck,\nuseAuth, useOnlineStatus, useTheme"]
    Utils["api.js, medicalTags.js,\nvoiceTagging.js, voiceSettings.js"]
  end

  subgraph server [Next.js Server]
    ServerActions["ai.js Server Actions\n8 Gemini functions"]
    TranscribeAPI["POST /api/transcribe"]
    SessionsAPI["Sessions API\nCRUD + utterances"]
    AuthAPI["Auth API\nlogin, register, me"]
    DbLib["db.js + auth.js"]
  end

  subgraph ext [External]
    Gemini["Google Gemini AI"]
    Neon["Neon PostgreSQL"]
  end

  InterpSession --> VPDoc
  InterpSession --> VPPat
  InterpSession --> CompScore
  InterpSession --> OtherUI
  InterpSession --> Hooks
  VPDoc --> Hooks
  VPPat --> Hooks
  Hooks --> Utils
  Hooks --> ServerActions
  Hooks --> TranscribeAPI
  Utils --> AuthAPI
  InterpSession --> SessionsAPI
  ServerActions --> Gemini
  TranscribeAPI --> Gemini
  SessionsAPI --> DbLib
  AuthAPI --> DbLib
  DbLib --> Neon
```

---

## Core Translation Pipeline

Each utterance flows through a 3-step independent pipeline — **the AI never grades its own homework**. Translation, back-translation, and scoring are separate LLM calls so no single model can inflate its own confidence.

```mermaid
sequenceDiagram
  participant Browser as Browser
  participant API as /api/transcribe
  participant Gemini as Gemini AI
  participant UI as VoicePanel
  participant DB as Database

  Browser->>API: Audio blob via FormData
  API->>Gemini: Base64 audio
  Gemini-->>API: Transcribed text
  API-->>Browser: text + model
  Browser->>Browser: Voice tagging + medical tag detection
  Browser->>UI: addUtterance (optimistic render)

  Note over Browser,Gemini: Step 1 — Translate
  Browser->>Gemini: translateText(src, tgt)
  Gemini-->>Browser: translatedText

  Note over Browser,Gemini: Step 2 — Back-translate (independent)
  Browser->>Gemini: backTranslate(translatedText)
  Gemini-->>Browser: backTranslation

  Note over Browser,Gemini: Step 3 — Score (independent)
  Browser->>Gemini: scoreComprehension(original, backTranslation)
  Gemini-->>Browser: accuracyScore + comprehensionScore

  Browser->>UI: updateUtterance with translation + scores + tags
  Browser->>DB: Persist utterance + audit log + translation memory
```

---

## Comprehension Check Flow

When a physician utterance contains a critical medical tag (`@consent`, `@surgical-risk`, `@procedure`), the system automatically generates a verification question in the patient's language and evaluates their response.

```mermaid
sequenceDiagram
  participant Session as InterpSession
  participant Check as ComprehensionCheck
  participant Gemini as Gemini AI
  participant Panel as PatientPanel

  Session->>Session: Detect critical tag (@consent, @surgical-risk)
  Session->>Check: initiateCheck(utterance)
  Check->>Gemini: generateComprehensionQuestion()
  Gemini-->>Check: Verification question in patient language
  Check->>Panel: Show comprehension check bubble

  Panel->>Check: Patient responds verbally
  Check->>Gemini: evaluateComprehensionResponse()
  Gemini-->>Check: understood + confidence + reason

  alt Patient understood
    Check->>Panel: PASS badge
  else Patient did not understand
    Check->>Gemini: simplifyUtterance()
    Gemini-->>Check: Simplified rephrasing
    Check->>Panel: FAIL badge + suggested rephrasing
  end
```

---

## Database Schema

```mermaid
erDiagram
  users {
    serial id PK
    varchar email UK
    varchar password_hash
    varchar name
    varchar role
  }

  sessions {
    serial id PK
    integer user_id FK
    varchar status
    varchar physician_lang
    varchar patient_lang
    varchar encounter_type
    real avg_comprehension
    real avg_accuracy
  }

  utterances {
    serial id PK
    integer session_id FK
    varchar role
    text original_text
    text translated_text
    text back_translation
    real accuracy_score
    real comprehension_score
    jsonb medical_tags
    boolean flagged
  }

  audit_log {
    serial id PK
    integer session_id FK
    integer actor_id FK
    varchar event_type
    jsonb event_data
  }

  translation_memory {
    serial id PK
    integer session_id FK
    integer utterance_id FK
    text source_text
    text translated_text
    real accuracy_score
    jsonb medical_tags
  }

  users ||--o{ sessions : "owns"
  users ||--o{ audit_log : "actor"
  sessions ||--o{ utterances : "contains"
  sessions ||--o{ audit_log : "logged"
  sessions ||--o{ translation_memory : "feeds"
  utterances ||--o| translation_memory : "sources"
```

---

## Key Components

| Component | File | Role |
|-----------|------|------|
| `InterpSession` | `src/components/InterpSession.jsx` | Main orchestrator — setup screen and chess board layout |
| `VoicePanel` | `src/components/VoicePanel.jsx` | One side of the board — mic button + scrolling transcript |
| `ComprehensionScore` | `src/components/ComprehensionScore.jsx` | Center widget — traffic-light accuracy/comprehension meters |
| `DemoMode` | `src/components/DemoMode.jsx` | Inject scripted utterances for live demos |
| `InterpreterDashboard` | `src/components/InterpreterDashboard.jsx` | Human interpreter correction panel |
| `InterpreterAlert` | `src/components/InterpreterAlert.jsx` | Escalation alert overlay |
| `AuditLog` | `src/components/AuditLog.jsx` | Compliance audit viewer |
| `AuthModal` | `src/components/AuthModal.jsx` | Login / register modal |

## Key Hooks

| Hook | File | Role |
|------|------|------|
| `useSession` | `src/hooks/useSession.js` | Session lifecycle (idle → active → paused → completed/escalated), utterance CRUD, running averages, escalation threshold |
| `useVoiceRecorder` | `src/hooks/useVoiceRecorder.js` | MediaRecorder + format detection, posts to `/api/transcribe`, applies voice tagging, WebSpeech fallback |
| `useTranslation` | `src/hooks/useTranslation.js` | 3-step independent pipeline: translate → back-translate → score. Detects medical tags on both source and translated text |
| `useComprehensionCheck` | `src/hooks/useComprehensionCheck.js` | COCO-style patient verification: generate question → evaluate response → simplify on failure |
| `useAuth` | `src/hooks/useAuth.jsx` | AuthContext provider with JWT token management |

## AI Pipeline (`src/utils/ai.js`)

All AI functions are Next.js server actions (`"use server"`) powered by Google Gemini.

| Function | Purpose |
|----------|---------|
| `translateText()` | Medical-grade translation preserving clinical meaning |
| `backTranslate()` | Independent reverse translation for verification |
| `scoreComprehension()` | Compares original vs back-translation, scores accuracy and comprehension |
| `transcribeAudio()` | Multimodal ASR via Gemini (base64 audio input) |
| `processVoiceTranscript()` | Clean up ASR output — fix stutters, preserve medical terms |
| `generateComprehensionQuestion()` | Generate verification question in patient's language |
| `evaluateComprehensionResponse()` | Evaluate whether patient understood the critical message |
| `simplifyUtterance()` | Rewrite medical statement in simpler language |

## File Structure

```
Interp/
├── app/
│   ├── layout.jsx                          # Root layout + AuthProvider
│   ├── page.jsx                            # Home → InterpSession
│   ├── globals.css
│   └── api/
│       ├── transcribe/route.js             # Gemini ASR endpoint
│       ├── sessions/
│       │   ├── route.js                    # List + create sessions
│       │   └── [id]/
│       │       ├── route.js                # Get + update session
│       │       └── utterances/route.js     # Persist utterance + audit + TM
│       ├── auth/
│       │   ├── login/route.js
│       │   ├── register/route.js
│       │   └── me/route.js
│       ├── health/route.js
│       └── ping/route.js
├── src/
│   ├── components/
│   │   ├── InterpSession.jsx + .css
│   │   ├── VoicePanel.jsx + .css
│   │   ├── ComprehensionScore.jsx + .css
│   │   ├── Header.jsx + .css
│   │   ├── AuthModal.jsx + .css
│   │   ├── DemoMode.jsx + .css
│   │   ├── InterpreterDashboard.jsx + .css
│   │   ├── InterpreterAlert.jsx + .css
│   │   ├── AuditLog.jsx + .css
│   │   └── OfflineBanner.jsx
│   ├── hooks/
│   │   ├── useSession.js
│   │   ├── useVoiceRecorder.js
│   │   ├── useTranslation.js
│   │   ├── useComprehensionCheck.js
│   │   ├── useAuth.jsx
│   │   ├── useOnlineStatus.js
│   │   └── useTheme.js
│   └── utils/
│       ├── ai.js                           # Server actions — all Gemini calls
│       ├── api.js                          # HTTP client + token management
│       ├── medicalTags.js                  # Keyword-based tag detection
│       ├── voiceTagging.js                 # Verbal command parser
│       ├── voiceSettings.js                # Voice model preferences
│       └── demoScenario.js                 # Scripted demo exchanges
├── lib/
│   ├── db.js                               # Neon PostgreSQL wrapper
│   └── auth.js                             # JWT + bcrypt + CORS
├── database/
│   ├── schema-neon.sql                     # Main schema (5 tables)
│   └── migration_translation_memory.sql    # Translation memory table
├── public/
│   ├── sw.js                               # Service worker (PWA)
│   └── manifest.json                       # PWA manifest
└── package.json
```

## Environment Variables

```
DATABASE_URL=       # Neon PostgreSQL connection string
JWT_SECRET=         # JWT signing key
GEMINI_API_KEY=     # Google Gemini AI API key
```

## Development

```bash
npm install
npm run dev
```

## Patent Pending

Combined AI + Human Interpreter Workflow — Patent Pending.
