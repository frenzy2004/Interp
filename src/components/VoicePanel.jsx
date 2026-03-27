"use client";
import { useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, AlertTriangle, HelpCircle } from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import './VoicePanel.css';

/**
 * VoicePanel — one side of the interpretation "chess board."
 * Shows a conversation transcript and a mic button.
 *
 * Props:
 *   role: 'physician' | 'patient'
 *   language: language code (e.g. 'en', 'es')
 *   languageLabel: display name (e.g. 'English')
 *   utterances: array of utterance objects for this panel's view
 *   onUtterance: callback when speech is captured → (text, asrModel)
 *   disabled: whether recording is disabled
 *   isAuthenticated: auth state
 */
export default function VoicePanel({
  role,
  language,
  languageLabel,
  utterances = [],
  onUtterance,
  disabled = false,
  isAuthenticated = false,
  pendingCheck = null,
  onDismissCheck,
  isCheckGenerating = false,
}) {
  const transcriptEndRef = useRef(null);

  const handleTranscript = (result) => {
    if (result?.cleaned) {
      onUtterance?.(result.cleaned, result.model, result.voiceTags ?? []);
    }
  };

  const { isRecording, isProcessing, toggleRecording, error } = useVoiceRecorder({
    language,
    onTranscript: handleTranscript,
    isAuthenticated,
  });

  // Auto-scroll to bottom on new utterances
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [utterances.length]);

  const isPhysician = role === 'physician';

  return (
    <div className={`voice-panel voice-panel--${role}`}>
      {/* Panel Header */}
      <div className="voice-panel__header">
        <div className="voice-panel__role-badge">
          <span className="voice-panel__role-dot" />
          <span className="voice-panel__role-label">
            {isPhysician ? 'Physician' : 'Patient'}
          </span>
        </div>
        <div className="voice-panel__lang">
          {languageLabel} · {language.toUpperCase()}
        </div>
      </div>

      {/* Transcript Area */}
      <div className="voice-panel__transcript">
        {utterances.length === 0 && (
          <div className="voice-panel__empty">
            <Mic size={32} strokeWidth={1.5} />
            <p>Tap the microphone to begin</p>
          </div>
        )}

        {utterances.map((utt) => {
          const isOwnUtterance = utt.role === role;
          // For own utterances: show original text
          // For other role's utterances: show translated text (in this panel's language)
          const displayText = isOwnUtterance
            ? utt.originalText
            : (utt.translatedText || null);
          const showOriginalFallback = !isOwnUtterance && !utt.translatedText;

          return (
            <div
              key={utt.id}
              className={`voice-panel__bubble voice-panel__bubble--${utt.role} ${utt.flagged ? 'voice-panel__bubble--flagged' : ''} ${!isOwnUtterance ? 'voice-panel__bubble--other' : ''}`}
            >
              <div className="voice-panel__bubble-header">
                <span className="voice-panel__bubble-role">
                  {utt.role}
                </span>
                {!isOwnUtterance && (
                  <span className="voice-panel__bubble-translated-badge">
                    translated
                  </span>
                )}
                {utt.flagged && <AlertTriangle size={14} className="voice-panel__flag-icon" />}
              </div>

              {/* Show the text relevant to this panel's language */}
              <p className="voice-panel__bubble-text">
                {displayText || utt.originalText}
              </p>

              {/* Show "translating..." note when other role's text hasn't been translated yet */}
              {showOriginalFallback && (
                <p className="voice-panel__bubble-pending">
                  ⏳ Awaiting translation...
                </p>
              )}

              {/* Back-translation verification (show on own utterances) */}
              {isOwnUtterance && utt.backTranslation && (
                <p className="voice-panel__bubble-back">
                  ↩ Back: {utt.backTranslation}
                </p>
              )}

              {/* Medical tags */}
              {utt.medicalTags?.length > 0 && (
                <div className="voice-panel__tags">
                  {utt.medicalTags.map(tag => (
                    <span key={tag} className={`voice-panel__tag voice-panel__tag--${tag}`}>
                      @{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Comprehension check result badge */}
              {utt.comprehensionCheck && utt.comprehensionCheck.status !== 'pending' && (
                <div className={`voice-panel__comprehension-badge voice-panel__comprehension-badge--${utt.comprehensionCheck.status}`}>
                  {utt.comprehensionCheck.status === 'pass' && '✓ Patient understood'}
                  {utt.comprehensionCheck.status === 'fail' && '⚠ Patient did not understand'}
                  {utt.comprehensionCheck.status === 'skipped' && '— Check skipped'}
                </div>
              )}

              {/* Simplified rephrasing if patient didn't understand */}
              {utt.comprehensionCheck?.status === 'fail' && utt.comprehensionCheck.simplifiedVersion && (
                <div className="voice-panel__simplified">
                  <span className="voice-panel__simplified-label">Suggested rephrasing:</span>
                  <p>{utt.comprehensionCheck.simplifiedVersion}</p>
                </div>
              )}

              {/* Score indicator */}
              <div className="voice-panel__bubble-meta">
                {utt.accuracyScore !== null && (
                  <span className={`voice-panel__score ${getScoreClass(utt.accuracyScore)}`}>
                    {Math.round(utt.accuracyScore)}%
                  </span>
                )}
                <span className="voice-panel__time">
                  {new Date(utt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {/* Comprehension check bubble — patient panel only */}
        {pendingCheck && (
          <div className="voice-panel__check-bubble">
            <div className="voice-panel__check-header">
              <HelpCircle size={14} />
              <span>Comprehension Check</span>
              {isCheckGenerating && <Loader2 size={12} className="voice-panel__mic-spin" />}
              <button className="voice-panel__check-dismiss" onClick={onDismissCheck}>Skip</button>
            </div>
            <p className="voice-panel__check-question">{pendingCheck.question}</p>
            <p className="voice-panel__check-hint">Please respond verbally using the microphone below.</p>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Mic Button */}
      <div className="voice-panel__controls">
        {error && <div className="voice-panel__error">{error}</div>}

        <button
          className={`voice-panel__mic ${isRecording ? 'voice-panel__mic--recording' : ''} ${isProcessing ? 'voice-panel__mic--processing' : ''} ${pendingCheck ? 'voice-panel__mic--check' : ''}`}
          onClick={toggleRecording}
          disabled={disabled || isProcessing || isCheckGenerating}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isProcessing ? (
            <Loader2 size={28} className="voice-panel__mic-spin" />
          ) : isRecording ? (
            <MicOff size={28} />
          ) : (
            <Mic size={28} />
          )}
        </button>

        {isRecording && (
          <div className="voice-panel__recording-indicator">
            <span className="voice-panel__recording-dot" />
            Listening...
          </div>
        )}
      </div>
    </div>
  );
}

function getScoreClass(score) {
  if (score >= 85) return 'voice-panel__score--good';
  if (score >= 60) return 'voice-panel__score--warn';
  return 'voice-panel__score--poor';
}
