"use client";
import { useState, useCallback, useEffect, useRef } from 'react';
import { FileText, Users, Pause, Play, Square, Plus, LogIn, RotateCcw, Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import { useSession, LANGUAGES } from '../hooks/useSession';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTheme } from '../hooks/useTheme';
import { useComprehensionCheck } from '../hooks/useComprehensionCheck';
import VoicePanel from './VoicePanel';
import ComprehensionScore from './ComprehensionScore';
import Header from './Header';
import AuthModal from './AuthModal';
import OfflineBanner from './OfflineBanner';
import DemoMode from './DemoMode';
import InterpreterAlert from './InterpreterAlert';
import AuditLog from './AuditLog';
import InterpreterDashboard from './InterpreterDashboard';
import { voiceSettings, VOICE_MODELS, VOICE_MODEL_LABELS, VOICE_MODEL_DESCRIPTIONS } from '../utils/voiceSettings';
import { useTTS } from '../hooks/useTTS';
import { getToken } from '../utils/api';
import './InterpSession.css';

const CRITICAL_CHECK_TAGS = ['consent', 'surgical-risk', 'procedure'];

export default function InterpSession() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [physicianLang, setPhysicianLang] = useState('en');
  const [patientLang, setPatientLang] = useState('es');
  const [encounterType, setEncounterType] = useState('outpatient');
  const [showEscalation, setShowEscalation] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showInterpreterDash, setShowInterpreterDash] = useState(false);
  const [voiceModel, setVoiceModel] = useState(VOICE_MODELS.STANDARD);
  // Layout modes: 'normal' → 'clock' → 'board' → 'normal'
  const [layoutMode, setLayoutMode] = useState('normal');
  const cycleLayout = useCallback(() => {
    setLayoutMode(m => m === 'normal' ? 'clock' : m === 'clock' ? 'board' : 'normal');
  }, []);

  // Sync voice model from localStorage after hydration
  useEffect(() => {
    setVoiceModel(voiceSettings.getModel());
  }, []);

  const handleVoiceModelChange = useCallback((e) => {
    const model = e.target.value;
    setVoiceModel(model);
    voiceSettings.setModel(model);
  }, []);

  const isOnline = useOnlineStatus();
  const { theme, toggleTheme } = useTheme();
  const { ttsEnabled, toggleTTS, speak } = useTTS();
  const { isAuthenticated } = useAuth();
  const { translate } = useTranslation();

  const {
    session,
    utterances,
    status,
    startSession,
    addUtterance,
    updateUtterance,
    escalateSession,
    pauseSession,
    resumeSession,
    endSession,
    latestComprehension,
    criticalTags,
    shouldEscalate,
  } = useSession();

  const {
    pendingCheckId,
    isGenerating: isCheckGenerating,
    initiateCheck,
    handleCheckResponse,
    dismissCheck,
  } = useComprehensionCheck({
    updateUtterance,
    patientLang: session?.patientLang || patientLang,
  });

  // Database session ID for persistence (null if unauthenticated)
  const dbSessionIdRef = useRef(null);

  // Handle starting a new session
  const handleStartSession = useCallback(async () => {
    const localSession = startSession(physicianLang, patientLang, encounterType);
    setShowSetup(false);

    // Create session in DB (background, non-blocking — works anonymous or authenticated)
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ localId: localSession.id, physicianLang, patientLang, encounterType }),
      });
      if (res.ok) {
        const data = await res.json();
        dbSessionIdRef.current = data.session?.id ?? null;
      }
    } catch (err) {
      console.warn('Session DB creation failed:', err.message);
    }
  }, [physicianLang, patientLang, encounterType, startSession]);

  // Handle new utterance from either panel
  const handleUtterance = useCallback(async ({ role, text, asrModel, voiceTags = [], rawAsrText = '' }) => {
    if (!text?.trim() || !session) return;

    // If patient is responding to a comprehension check — route to check handler
    if (role === 'patient' && pendingCheckId) {
      await handleCheckResponse(text);
      return;
    }

    // If physician speaks while check is pending — dismiss the check and continue
    if (role === 'physician' && pendingCheckId) {
      dismissCheck();
    }

    const sourceLang = role === 'physician' ? session.physicianLang : session.patientLang;
    const targetLang = role === 'physician' ? session.patientLang : session.physicianLang;

    // 1. Add utterance immediately (optimistic, shows original text)
    const entry = addUtterance({
      role,
      originalText: text,
      rawAsrText: rawAsrText || text,
      sourceLang,
      targetLang,
      asrModel,
      medicalTags: voiceTags,
    });

    // 2. Translate in background (3-step independent pipeline)
    try {
      const result = await translate(text, sourceLang, targetLang);
      if (result) {
        const mergedTags = [...new Set([...voiceTags, ...(result.medicalTags || [])])];

        updateUtterance(entry.id, {
          translatedText: result.translatedText,
          backTranslation: result.backTranslation,
          accuracyScore: result.accuracyScore,
          comprehensionScore: result.comprehensionScore,
          medicalTags: mergedTags,
        });

        speak(result.translatedText, targetLang);

        // Trigger comprehension check for critical physician utterances
        if (role === 'physician' && mergedTags.some(t => CRITICAL_CHECK_TAGS.includes(t))) {
          initiateCheck({ ...entry, translatedText: result.translatedText, medicalTags: mergedTags });
        }

        // Persist utterance + translation memory to DB (background, non-blocking)
        if (dbSessionIdRef.current) {
          const headers = { 'Content-Type': 'application/json' };
          const token = getToken();
          if (token) headers.Authorization = `Bearer ${token}`;

          fetch(`/api/sessions/${dbSessionIdRef.current}/utterances`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              role, originalText: text, translatedText: result.translatedText,
              backTranslation: result.backTranslation, sourceLang, targetLang,
              accuracyScore: result.accuracyScore, comprehensionScore: result.comprehensionScore,
              medicalTags: mergedTags, issues: result.issues, asrModel,
            }),
          }).catch(err => console.warn('Utterance persist failed:', err.message));
        }
      }
    } catch (err) {
      console.error('Translation failed:', err);
      updateUtterance(entry.id, {
        flagged: true,
        flagReason: 'Translation failed',
      });
    }
  }, [session, addUtterance, updateUtterance, translate, pendingCheckId, handleCheckResponse, dismissCheck, initiateCheck, speak]);

  // Demo mode inject handler — bypasses mic/ASR entirely
  const handleDemoInject = useCallback((role, text) => {
    handleUtterance({ role, text, asrModel: 'demo' });
  }, [handleUtterance]);

  // Interpreter correction handler
  const handleInterpreterCorrection = useCallback((utteranceId, correctedText) => {
    updateUtterance(utteranceId, { translatedText: correctedText, interpreterCorrected: true });
  }, [updateUtterance]);

  // Handle escalation
  const handleEscalate = useCallback(() => {
    escalateSession('Comprehension score below threshold');
  }, [escalateSession]);

  // Handle end session
  const handleEndSession = useCallback(() => {
    endSession();
  }, [endSession]);

  // Handle new session (reset)
  const handleNewSession = useCallback(() => {
    setShowSetup(true);
    setShowEscalation(false);
    setShowAuditLog(false);
    setShowInterpreterDash(false);
  }, []);

  // Watch for escalation trigger
  useEffect(() => {
    if (shouldEscalate && status === 'active' && !showEscalation) {
      setShowEscalation(true);
    }
  }, [shouldEscalate, status, showEscalation]);

  // Pending check utterance (for VoicePanel)
  const pendingCheck = pendingCheckId
    ? utterances.find(u => u.id === pendingCheckId)?.comprehensionCheck ?? null
    : null;

  // ─── Render ─────────────────────────────────────────────────────────────

  // Setup screen
  if (showSetup) {
    return (
      <div className="interp">
        <Header
          onOpenAuth={() => setShowAuthModal(true)}
          isAuthenticated={isAuthenticated}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {!isOnline && <OfflineBanner />}

        <div className="interp__setup">
          <div className="interp__setup-card">
            <div className="interp__setup-logo">
              <img src="/interp-logo.svg" alt="interp" className="interp__setup-logo-img" />
              <p className="interp__setup-subtitle">Beyond translation, into interpretation</p>
            </div>

            <div className="interp__setup-fields">
              <div className="interp__setup-field">
                <label>Physician Language</label>
                <select value={physicianLang} onChange={(e) => setPhysicianLang(e.target.value)}>
                  {Object.entries(LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="interp__setup-field">
                <label>Patient Language</label>
                <select value={patientLang} onChange={(e) => setPatientLang(e.target.value)}>
                  {Object.entries(LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="interp__setup-field">
                <label>Encounter Type</label>
                <select value={encounterType} onChange={(e) => setEncounterType(e.target.value)}>
                  <option value="outpatient">Outpatient</option>
                  <option value="er">Emergency</option>
                  <option value="surgery">Surgery</option>
                  <option value="inpatient">Inpatient</option>
                </select>
              </div>

              <div className="interp__setup-field">
                <label>Voice Model</label>
                <select value={voiceModel} onChange={handleVoiceModelChange}>
                  {Object.entries(VOICE_MODEL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <span className="interp__setup-hint">
                  {VOICE_MODEL_DESCRIPTIONS[voiceModel]}
                </span>
              </div>
            </div>

            <button
              className="interp__setup-start"
              onClick={handleStartSession}
            >
              Start Interpretation Session
            </button>
          </div>
        </div>

        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </div>
    );
  }

  // ─── Active Session — The Chess Board ─────────────────────────────────

  return (
    <div className={`interp ${layoutMode !== 'normal' ? `interp--${layoutMode}` : ''}`}>
      {!isOnline && <OfflineBanner />}

      <div className="interp__toolbar">
        <DemoMode
          onInjectUtterance={handleDemoInject}
          disabled={status !== 'active'}
        />
        <button className={`interp-header__btn ${showInterpreterDash ? 'interp-header__btn--glow-blue' : ''}`} onClick={() => setShowInterpreterDash(true)}>
          <Users size={16} />
          <span>Interpreter</span>
        </button>
        <button className={`interp-header__btn ${showAuditLog ? 'interp-header__btn--glow-indigo' : ''}`} onClick={() => setShowAuditLog(true)}>
          <FileText size={16} />
          <span>Audit Log</span>
        </button>

        <div className="interp__toolbar-spacer" />

        <button
          className={`interp-header__btn ${ttsEnabled ? 'interp-header__btn--glow-blue' : ''}`}
          onClick={toggleTTS}
          title={ttsEnabled ? 'Voice output on — click to mute' : 'Voice output off — click to enable'}
        >
          {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <button className={`interp-header__btn ${theme === 'light' ? 'interp-header__btn--glow-amber' : ''}`} onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {!isAuthenticated && (
          <button className="interp-header__btn" onClick={() => setShowAuthModal(true)}>
            <LogIn size={16} />
            <span>Sign In</span>
          </button>
        )}

        <button
          className={`interp-header__btn ${layoutMode !== 'normal' ? 'interp-header__btn--active' : ''}`}
          onClick={cycleLayout}
          title={layoutMode === 'normal' ? 'Clock mode' : layoutMode === 'clock' ? 'Board mode' : 'Normal mode'}
        >
          <RotateCcw size={16} />
        </button>

        {(status === 'active' || status === 'paused') && (
          <>
            <button className="interp-header__btn" onClick={status === 'active' ? pauseSession : resumeSession} title={status === 'paused' ? 'Resume' : 'Pause'}>
              {status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button className="interp-header__btn interp-header__btn--danger" onClick={handleEndSession} title="End session">
              <Square size={16} />
              <span>End</span>
            </button>
          </>
        )}
        {(status === 'completed' || status === 'escalated') && (
          <button className="interp-header__btn interp-header__btn--primary" onClick={handleNewSession}>
            <Plus size={16} />
            <span>New Session</span>
          </button>
        )}
      </div>

      <div className="interp__board">
        {/* Left — Physician Panel */}
        <VoicePanel
          role="physician"
          language={session?.physicianLang || 'en'}
          languageLabel={LANGUAGES[session?.physicianLang] || 'English'}
          utterances={utterances}
          onUtterance={({ text, asrModel, voiceTags, rawAsrText }) => handleUtterance({ role: 'physician', text, asrModel, voiceTags, rawAsrText })}
          disabled={status !== 'active'}
          isAuthenticated={isAuthenticated}
        />

        {/* Center — Comprehension Score */}
        <ComprehensionScore
          comprehension={session?.avgComprehension ?? null}
          accuracy={session?.avgAccuracy ?? null}
          shouldEscalate={shouldEscalate}
          criticalTags={criticalTags}
          utteranceCount={utterances.length}
          onEscalate={handleEscalate}
          status={status}
        />

        {/* Right — Patient Panel */}
        <VoicePanel
          role="patient"
          language={session?.patientLang || 'es'}
          languageLabel={LANGUAGES[session?.patientLang] || 'Spanish'}
          utterances={utterances}
          onUtterance={({ text, asrModel, voiceTags, rawAsrText }) => handleUtterance({ role: 'patient', text, asrModel, voiceTags, rawAsrText })}
          disabled={status !== 'active'}
          isAuthenticated={isAuthenticated}
          pendingCheck={pendingCheck}
          onDismissCheck={dismissCheck}
          isCheckGenerating={isCheckGenerating}
        />
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      {showEscalation && (
        <InterpreterAlert
          reason="Patient comprehension below 60% threshold. Language gap detected in high-risk encounter."
          onDismiss={() => setShowEscalation(false)}
        />
      )}

      {showAuditLog && (
        <AuditLog
          session={session}
          utterances={utterances}
          onClose={() => setShowAuditLog(false)}
        />
      )}

      {showInterpreterDash && (
        <InterpreterDashboard
          session={session}
          utterances={utterances}
          onClose={() => setShowInterpreterDash(false)}
          onCorrect={handleInterpreterCorrection}
        />
      )}
    </div>
  );
}
