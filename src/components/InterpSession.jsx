"use client";
import { useState, useCallback, useEffect } from 'react';
import { FileText, Users } from 'lucide-react';
import { useSession, LANGUAGES } from '../hooks/useSession';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { speakText } from '../utils/ai';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
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

  const isOnline = useOnlineStatus();
  const { isAuthenticated } = useAuth();
  const { translate, isTranslating } = useTranslation();

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

  // Handle starting a new session
  const handleStartSession = useCallback(() => {
    startSession(physicianLang, patientLang, encounterType);
    setShowSetup(false);
  }, [physicianLang, patientLang, encounterType, startSession]);

  // Handle new utterance from either panel
  const handleUtterance = useCallback(async (role, text, asrModel, voiceTags = []) => {
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

        // Speak the translation aloud in the target language
        speakText(result.translatedText).then((audioBase64) => {
          if (!audioBase64) return;
          const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
          audio.play().catch(() => {});
        }).catch((err) => console.error('TTS error:', err));

        // Trigger comprehension check for critical physician utterances
        if (role === 'physician' && mergedTags.some(t => CRITICAL_CHECK_TAGS.includes(t))) {
          initiateCheck({ ...entry, translatedText: result.translatedText, medicalTags: mergedTags });
        }
      }
    } catch (err) {
      console.error('Translation failed:', err);
      updateUtterance(entry.id, {
        flagged: true,
        flagReason: 'Translation failed',
      });
    }
  }, [session, addUtterance, updateUtterance, translate, pendingCheckId, handleCheckResponse, dismissCheck, initiateCheck]);

  // Demo mode inject handler — bypasses mic/ASR entirely
  const handleDemoInject = useCallback((role, text) => {
    handleUtterance(role, text, 'demo');
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
        />
        {!isOnline && <OfflineBanner />}

        <div className="interp__setup">
          <div className="interp__setup-card">
            <div className="interp__setup-logo">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="#3b82f6" strokeWidth="2" fill="none" />
                <circle cx="20" cy="20" r="8" stroke="#f97316" strokeWidth="2" fill="none" />
                <path d="M20 2 L20 12 M20 28 L20 38 M2 20 L12 20 M28 20 L38 20" stroke="#3b82f6" strokeWidth="1.5" opacity="0.3" />
              </svg>
              <h1 className="interp__setup-title">interp</h1>
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
    <div className="interp">
      <Header
        onOpenAuth={() => setShowAuthModal(true)}
        isAuthenticated={isAuthenticated}
        sessionActive={status === 'active' || status === 'paused'}
        onEndSession={handleEndSession}
        onPauseSession={status === 'active' ? pauseSession : resumeSession}
        isPaused={status === 'paused'}
        onNewSession={status === 'completed' || status === 'escalated' ? handleNewSession : undefined}
      />
      {!isOnline && <OfflineBanner />}

      <div className="interp__toolbar">
        <DemoMode
          onInjectUtterance={handleDemoInject}
          disabled={status !== 'active'}
        />
        <button className="interp-header__btn" onClick={() => setShowInterpreterDash(true)}>
          <Users size={16} />
          <span>Interpreter</span>
        </button>
        <button className="interp-header__btn" onClick={() => setShowAuditLog(true)}>
          <FileText size={16} />
          <span>Audit Log</span>
        </button>
      </div>

      <div className="interp__board">
        {/* Left — Physician Panel */}
        <VoicePanel
          role="physician"
          language={session?.physicianLang || 'en'}
          languageLabel={LANGUAGES[session?.physicianLang] || 'English'}
          utterances={utterances}
          onUtterance={(text, model, voiceTags) => handleUtterance('physician', text, model, voiceTags)}
          disabled={status !== 'active' || isTranslating}
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
          onUtterance={(text, model, voiceTags) => handleUtterance('patient', text, model, voiceTags)}
          disabled={status !== 'active' || isTranslating}
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
