# Interp

**Human-verified AI medical interpretation in emergency departments.**

> Beyond translation, into interpretation.

Built with Next.js 16, React 19, Google Gemini AI, Neon PostgreSQL, and deployed on Vercel.

---

## System Architecture

```mermaid
graph TB
  subgraph browser [Browser]
    subgraph pages [Next.js App Router]
      RootLayout["RootLayout\n(layout.jsx)"]
      HomePage["Home\n(page.jsx)"]
      RootLayout --> HomePage
    end

    subgraph components [React Components]
      InterpSession["InterpSession\n(orchestrator)"]
      VPDoc["VoicePanel\nPhysician"]
      CompScore["ComprehensionScore\nCenter Widget"]
      VPPat["VoicePanel\nPatient"]
      Header_["Header"]
      AuthModal_["AuthModal"]
      DemoMode_["DemoMode"]
      InterpDash["InterpreterDashboard"]
      InterpAlert["InterpreterAlert"]
      AuditLog_["AuditLog"]
      OfflineBanner_["OfflineBanner"]
    end

    subgraph hooks [Custom Hooks]
      useSession_["useSession"]
      useVoiceRec["useVoiceRecorder"]
      useTranslation_["useTranslation"]
      useCompCheck["useComprehensionCheck"]
      useAuth_["useAuth"]
      useOnline["useOnlineStatus"]
      useTheme_["useTheme"]
    end

    subgraph clientUtils [Client Utilities]
      apiClient["api.js"]
      medTags["medicalTags.js"]
      voiceTag["voiceTagging.js"]
      voiceSet["voiceSettings.js"]
      demoScen["demoScenario.js"]
    end
  end

  subgraph server [Next.js Server]
    subgraph svrActions [Server Actions]
      aiModule["ai.js\n8 Gemini functions"]
    end

    subgraph apiRoutes [API Routes]
      transcribeRoute["POST /api/transcribe"]
      sessionsRoute["GET+POST /api/sessions"]
      sessionIdRoute["GET+PUT /api/sessions/id"]
      uttRoute["POST /api/sessions/id/utterances"]
      authRoutes["POST /api/auth/login\nPOST /api/auth/register\nGET /api/auth/me"]
      opsRoutes["GET /api/health\nGET /api/ping"]
    end

    subgraph libs [Server Libraries]
      dbLib["db.js\nNeon SQL wrapper"]
      authLib["auth.js\nJWT + bcrypt"]
    end
  end

  subgraph external [External Services]
    Gemini["Google Gemini AI"]
    NeonDB["Neon PostgreSQL"]
    VercelPlat["Vercel"]
    BrowserAPIs["Browser APIs\nMediaRecorder + WebSpeech"]
  end

  HomePage --> InterpSession
  InterpSession --> VPDoc
  InterpSession --> CompScore
  InterpSession --> VPPat
  InterpSession --> Header_
  InterpSession --> AuthModal_
  InterpSession --> DemoMode_
  InterpSession --> InterpDash
  InterpSession --> InterpAlert
  InterpSession --> AuditLog_
  InterpSession --> OfflineBanner_

  InterpSession --> useSession_
  InterpSession --> useTranslation_
  InterpSession --> useCompCheck
  InterpSession --> useAuth_
  InterpSession --> useOnline
  InterpSession --> useTheme_
  VPDoc --> useVoiceRec
  VPPat --> useVoiceRec

  useAuth_ --> apiClient
  useVoiceRec --> voiceTag
  useVoiceRec --> voiceSet
  useTranslation_ --> aiModule
  useTranslation_ --> medTags
  useCompCheck --> aiModule
  DemoMode_ --> demoScen

  useVoiceRec --> transcribeRoute
  apiClient --> authRoutes
  InterpSession --> sessionsRoute
  InterpSession --> uttRoute

  transcribeRoute --> Gemini
  aiModule --> Gemini
  sessionsRoute --> dbLib
  sessionIdRoute --> dbLib
  uttRoute --> dbLib
  authRoutes --> dbLib
  authRoutes --> authLib
  opsRoutes --> dbLib
  dbLib --> NeonDB
  useVoiceRec --> BrowserAPIs
```

---

## Core Translation Pipeline

Each utterance flows through a 3-step independent pipeline — **the AI never grades its own homework**. Translation, back-translation, and scoring are separate LLM calls so no single model can inflate its own confidence.

```mermaid
sequenceDiagram
  participant Mic as Microphone
  participant VR as useVoiceRecorder
  participant ASR as /api/transcribe
  participant Gem1 as Gemini ASR
  participant VT as voiceTagging.js
  participant Sess as useSession
  participant T as useTranslation
  participant Gem2 as Gemini Translate
  participant Gem3 as Gemini BackTranslate
  participant Gem4 as Gemini Score
  participant MT as medicalTags.js
  participant UI as VoicePanel
  participant DB as /api/utterances

  Mic->>VR: Audio blob
  VR->>ASR: POST FormData
  ASR->>Gem1: Base64 audio + language
  Gem1-->>ASR: Transcribed text
  ASR-->>VR: text + model
  VR->>VT: applyVoiceTagging(text)
  VT-->>VR: cleaned text + tag IDs
  VR->>Sess: addUtterance (optimistic)
  Sess->>UI: Render original text immediately

  Sess->>T: translate(text, src, tgt)
  T->>Gem2: Step 1 translateText()
  Gem2-->>T: translatedText
  T->>Gem3: Step 2 backTranslate()
  Gem3-->>T: backTranslation
  T->>Gem4: Step 3 scoreComprehension()
  Gem4-->>T: accuracyScore + comprehensionScore
  T->>MT: detectMedicalTags()
  MT-->>T: merged tag IDs
  T-->>Sess: updateUtterance
  Sess->>UI: Render translation + scores + tags

  Sess->>DB: POST persist (fire-and-forget)
  DB->>DB: utterance + audit_log + translation_memory
```

---

## Comprehension Check Flow

When a physician utterance contains a critical medical tag (`@consent`, `@surgical-risk`, `@procedure`), the system automatically generates a verification question in the patient's language and evaluates their response.

```mermaid
sequenceDiagram
  participant IS as InterpSession
  participant CC as useComprehensionCheck
  participant GenQ as Gemini GenQuestion
  participant UI as Patient VoicePanel
  participant PatMic as Patient Mic
  participant Eval as Gemini EvalResponse
  participant Simp as Gemini Simplify

  IS->>IS: Detect critical tag
  IS->>CC: initiateCheck(utterance)
  CC->>GenQ: generateComprehensionQuestion()
  GenQ-->>CC: Question in patient language
  CC->>UI: Show check bubble

  PatMic->>UI: Patient speaks
  UI->>CC: handleCheckResponse(text)
  CC->>Eval: evaluateComprehensionResponse()
  Eval-->>CC: understood + confidence + reason

  alt Patient understood
    CC->>UI: PASS badge
  else Patient did not understand
    CC->>Simp: simplifyUtterance()
    Simp-->>CC: Simplified rephrasing
    CC->>UI: FAIL badge + suggested rephrasing
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
    varchar department
    timestamptz created_at
    timestamptz updated_at
    timestamptz last_login_at
  }

  sessions {
    serial id PK
    integer user_id FK
    varchar local_id UK
    varchar status
    varchar physician_lang
    varchar patient_lang
    varchar encounter_type
    varchar patient_mrn
    real avg_comprehension
    real avg_accuracy
    timestamptz escalated_at
    text escalation_reason
    timestamptz created_at
    timestamptz completed_at
  }

  utterances {
    serial id PK
    integer session_id FK
    varchar role
    text original_text
    text translated_text
    text back_translation
    varchar source_lang
    varchar target_lang
    real accuracy_score
    real comprehension_score
    jsonb medical_tags
    boolean flagged
    text flag_reason
    varchar asr_model
    timestamptz created_at
  }

  audit_log {
    serial id PK
    integer session_id FK
    varchar event_type
    jsonb event_data
    integer actor_id FK
    timestamptz created_at
  }

  medical_tags {
    varchar id PK
    varchar label
    varchar color
    varchar severity
    timestamptz created_at
  }

  translation_memory {
    serial id PK
    text source_text
    text translated_text
    text back_translation
    varchar source_lang
    varchar target_lang
    real accuracy_score
    real comprehension_score
    jsonb medical_tags
    jsonb issues
    varchar asr_model
    integer session_id FK
    integer utterance_id FK
    timestamptz created_at
  }

  users ||--o{ sessions : "owns"
  sessions ||--o{ utterances : "contains"
  sessions ||--o{ audit_log : "logged"
  users ||--o{ audit_log : "actor"
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
