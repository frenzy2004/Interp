"use client";
import { useState, useCallback, useRef } from 'react';

/**
 * useSession — manages interpretation session state.
 * Replaces useTasks from Taskwind.
 *
 * Session lifecycle: idle → active → paused → completed/escalated
 * Each session contains an ordered list of utterances.
 */

const LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  zh: 'Mandarin',
  vi: 'Vietnamese',
  ko: 'Korean',
  tl: 'Tagalog',
  ar: 'Arabic',
  fr: 'French',
  pt: 'Portuguese',
  ru: 'Russian',
  ja: 'Japanese',
  hi: 'Hindi',
  bn: 'Bengali',
  de: 'German',
  ms: 'Malay',
  ta: 'Tamil',
};

export { LANGUAGES };

function generateId() {
  return `utt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function useSession() {
  const [session, setSession] = useState(null);
  const [utterances, setUtterances] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, active, paused, completed, escalated
  const utterancesRef = useRef([]);

  // Keep ref in sync for callbacks
  const updateUtterances = useCallback((updater) => {
    setUtterances(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      utterancesRef.current = next;
      return next;
    });
  }, []);

  // Start a new session
  const startSession = useCallback((physicianLang = 'en', patientLang = 'es', encounterType = 'outpatient') => {
    const newSession = {
      id: generateSessionId(),
      physicianLang,
      patientLang,
      encounterType,
      department: '',
      startedAt: Date.now(),
      avgComprehension: 0,
      avgAccuracy: 0,
    };
    setSession(newSession);
    updateUtterances([]);
    setStatus('active');
    return newSession;
  }, [updateUtterances]);

  // Add an utterance to the session
  const addUtterance = useCallback((utterance) => {
    const entry = {
      id: generateId(),
      role: utterance.role, // 'physician' or 'patient'
      originalText: utterance.originalText,
      rawAsrText: utterance.rawAsrText || '',
      translatedText: utterance.translatedText || '',
      backTranslation: utterance.backTranslation || '',
      sourceLang: utterance.sourceLang,
      targetLang: utterance.targetLang,
      accuracyScore: utterance.accuracyScore || null,
      comprehensionScore: utterance.comprehensionScore || null,
      medicalTags: utterance.medicalTags || [],
      flagged: utterance.flagged || false,
      flagReason: utterance.flagReason || '',
      asrModel: utterance.asrModel || '',
      comprehensionCheck: utterance.comprehensionCheck ?? null,
      interpreterCorrected: false,
      timestamp: Date.now(),
    };

    updateUtterances(prev => {
      const next = [...prev, entry];

      // Recompute session averages
      const scored = next.filter(u => u.accuracyScore !== null);
      if (scored.length > 0 && session) {
        const avgAcc = scored.reduce((sum, u) => sum + u.accuracyScore, 0) / scored.length;
        const avgComp = scored.reduce((sum, u) => sum + (u.comprehensionScore || 0), 0) / scored.length;
        setSession(prev => prev ? { ...prev, avgAccuracy: avgAcc, avgComprehension: avgComp } : prev);
      }

      return next;
    });

    return entry;
  }, [session, updateUtterances]);

  // Update a pending utterance with translation results
  const updateUtterance = useCallback((id, updates) => {
    updateUtterances(prev => {
      const next = prev.map(u => u.id === id ? { ...u, ...updates } : u);

      // Recompute averages
      const scored = next.filter(u => u.accuracyScore !== null);
      if (scored.length > 0) {
        const avgAcc = scored.reduce((sum, u) => sum + u.accuracyScore, 0) / scored.length;
        const avgComp = scored.reduce((sum, u) => sum + (u.comprehensionScore || 0), 0) / scored.length;
        setSession(prev => prev ? { ...prev, avgAccuracy: avgAcc, avgComprehension: avgComp } : prev);
      }

      return next;
    });
  }, [updateUtterances]);

  // Flag an utterance for interpreter review
  const flagUtterance = useCallback((id, reason = '') => {
    updateUtterances(prev =>
      prev.map(u => u.id === id ? { ...u, flagged: true, flagReason: reason } : u)
    );
  }, [updateUtterances]);

  // Escalate session to human interpreter
  const escalateSession = useCallback((reason = '') => {
    setStatus('escalated');
    setSession(prev => prev ? {
      ...prev,
      escalatedAt: Date.now(),
      escalationReason: reason,
    } : prev);
  }, []);

  // Pause / resume
  const pauseSession = useCallback(() => setStatus('paused'), []);
  const resumeSession = useCallback(() => setStatus('active'), []);

  // End session
  const endSession = useCallback(() => {
    setStatus('completed');
    setSession(prev => prev ? { ...prev, completedAt: Date.now() } : prev);
  }, []);

  // Computed: latest comprehension score
  const latestComprehension = utterances.length > 0
    ? utterances.filter(u => u.comprehensionScore !== null).slice(-1)[0]?.comprehensionScore ?? null
    : null;

  // Computed: any critical medical tags in session
  const criticalTags = [...new Set(
    utterances.flatMap(u => u.medicalTags).filter(t => ['consent', 'allergy', 'surgical-risk'].includes(t))
  )];

  // Computed: should escalate (comprehension dropped below threshold)
  const shouldEscalate = latestComprehension !== null && latestComprehension < 60;

  return {
    session,
    utterances,
    status,
    startSession,
    addUtterance,
    updateUtterance,
    flagUtterance,
    escalateSession,
    pauseSession,
    resumeSession,
    endSession,
    latestComprehension,
    criticalTags,
    shouldEscalate,
    LANGUAGES,
  };
}
