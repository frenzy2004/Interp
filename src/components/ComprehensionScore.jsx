"use client";
import { AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react';
import './ComprehensionScore.css';

/**
 * ComprehensionScore — the understanding verification widget.
 * Sits between the two voice panels like the center of a chess board.
 *
 * Shows real-time comprehension and accuracy scores with traffic-light colors.
 */
export default function ComprehensionScore({
  comprehension,
  accuracy,
  shouldEscalate,
  criticalTags = [],
  utteranceCount = 0,
  onEscalate,
  status = 'idle',
}) {
  const getLevel = (score) => {
    if (score === null || score === undefined) return 'none';
    if (score >= 85) return 'good';
    if (score >= 60) return 'warn';
    return 'poor';
  };

  const compLevel = getLevel(comprehension);
  const accLevel = getLevel(accuracy);

  const getIcon = (level) => {
    switch (level) {
      case 'good': return <CheckCircle size={16} />;
      case 'warn': return <AlertTriangle size={16} />;
      case 'poor': return <XCircle size={16} />;
      default: return <Activity size={16} />;
    }
  };

  return (
    <div className={`comp-score ${shouldEscalate ? 'comp-score--alert' : ''}`}>
      {/* Status indicator */}
      <div className={`comp-score__status comp-score__status--${status}`}>
        <span className="comp-score__status-dot" />
        <span className="comp-score__status-label">
          {status === 'active' ? 'Live Session' :
           status === 'escalated' ? 'Interpreter Needed' :
           status === 'paused' ? 'Paused' :
           status === 'completed' ? 'Completed' : 'Ready'}
        </span>
      </div>

      {/* Scores */}
      {utteranceCount > 0 && (
        <div className="comp-score__meters">
          <div className={`comp-score__meter comp-score__meter--${compLevel}`}>
            {getIcon(compLevel)}
            <div className="comp-score__meter-info">
              <span className="comp-score__meter-label">Comprehension</span>
              <span className="comp-score__meter-value">
                {comprehension !== null ? `${Math.round(comprehension)}%` : '—'}
              </span>
            </div>
          </div>

          <div className={`comp-score__meter comp-score__meter--${accLevel}`}>
            {getIcon(accLevel)}
            <div className="comp-score__meter-info">
              <span className="comp-score__meter-label">Accuracy</span>
              <span className="comp-score__meter-value">
                {accuracy !== null ? `${Math.round(accuracy)}%` : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Critical tags alert */}
      {criticalTags.length > 0 && (
        <div className="comp-score__critical">
          {criticalTags.map(tag => (
            <span key={tag} className="comp-score__critical-tag">@{tag}</span>
          ))}
        </div>
      )}

      {/* Escalation button */}
      {shouldEscalate && status === 'active' && (
        <button className="comp-score__escalate" onClick={onEscalate}>
          <AlertTriangle size={16} />
          Request Interpreter
        </button>
      )}

      {/* Utterance count */}
      <div className="comp-score__count">
        {utteranceCount} exchange{utteranceCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
