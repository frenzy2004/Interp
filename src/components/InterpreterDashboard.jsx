"use client";
import { useState, useRef, useEffect } from 'react';
import { X, Pencil, Check, X as XIcon } from 'lucide-react';
import './InterpreterDashboard.css';

export default function InterpreterDashboard({ session, utterances, onClose, onCorrect }) {
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const transcriptEndRef = useRef(null);

  // Auto-scroll to newest utterance
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [utterances.length]);

  const startEdit = (utt) => {
    setEditingId(utt.id);
    setEditText(utt.translatedText || '');
  };

  const saveEdit = () => {
    if (editText.trim()) {
      onCorrect(editingId, editText.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const checkBadgeLabel = (status) => {
    if (status === 'pass') return '✓ Understood';
    if (status === 'fail') return '⚠ Not understood';
    if (status === 'pending') return '⏳ Checking...';
    return '— Skipped';
  };

  return (
    <div className="interp-dash__overlay" onClick={onClose}>
      <div className="interp-dash__panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="interp-dash__header">
          <div className="interp-dash__title">
            <span className="interp-dash__live-dot" />
            Live Interpreter Monitor
          </div>
          <button className="interp-dash__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Session meta */}
        {session && (
          <div className="interp-dash__meta">
            {utterances.length} exchange{utterances.length !== 1 ? 's' : ''} ·
            Physician: {session.physicianLang?.toUpperCase()} →
            Patient: {session.patientLang?.toUpperCase()}
          </div>
        )}

        {/* Transcript */}
        <div className="interp-dash__transcript">
          {utterances.length === 0 && (
            <p className="interp-dash__empty">No utterances yet. Session will appear here in real-time.</p>
          )}

          {utterances.map((utt) => (
            <div key={utt.id} className={`interp-dash__card interp-dash__card--${utt.role}`}>
              {/* Card header */}
              <div className="interp-dash__card-header">
                <span className="interp-dash__role">{utt.role}</span>
                <span className="interp-dash__time">
                  {new Date(utt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {utt.interpreterCorrected && (
                  <span className="interp-dash__corrected-badge">corrected</span>
                )}
              </div>

              {/* Original */}
              <div className="interp-dash__field">
                <span className="interp-dash__field-label">Original</span>
                <p className="interp-dash__field-text">{utt.originalText}</p>
              </div>

              {/* Translation — editable */}
              <div className="interp-dash__field">
                <div className="interp-dash__field-row">
                  <span className="interp-dash__field-label">Translation</span>
                  {editingId !== utt.id && utt.translatedText && (
                    <button className="interp-dash__edit-btn" onClick={() => startEdit(utt)}>
                      <Pencil size={12} /> Edit
                    </button>
                  )}
                </div>

                {editingId === utt.id ? (
                  <div className="interp-dash__edit-area">
                    <textarea
                      className="interp-dash__textarea"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div className="interp-dash__edit-actions">
                      <button className="interp-dash__save-btn" onClick={saveEdit}>
                        <Check size={12} /> Save
                      </button>
                      <button className="interp-dash__cancel-btn" onClick={cancelEdit}>
                        <XIcon size={12} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="interp-dash__field-text interp-dash__field-text--translation">
                    {utt.translatedText || <em className="interp-dash__pending">Awaiting translation…</em>}
                  </p>
                )}
              </div>

              {/* Medical tags */}
              {utt.medicalTags?.length > 0 && (
                <div className="interp-dash__tags">
                  {utt.medicalTags.map(tag => (
                    <span key={tag} className={`voice-panel__tag voice-panel__tag--${tag}`}>
                      @{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Comprehension check badge */}
              {utt.comprehensionCheck && (
                <div className={`interp-dash__check-badge interp-dash__check-badge--${utt.comprehensionCheck.status}`}>
                  {checkBadgeLabel(utt.comprehensionCheck.status)}
                  {utt.comprehensionCheck.question && (
                    <span className="interp-dash__check-q"> · {utt.comprehensionCheck.question}</span>
                  )}
                </div>
              )}
            </div>
          ))}

          <div ref={transcriptEndRef} />
        </div>
      </div>
    </div>
  );
}
