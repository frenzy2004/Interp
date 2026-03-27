"use client";
import { AlertTriangle } from 'lucide-react';
import './InterpreterAlert.css';

export default function InterpreterAlert({ reason, onDismiss }) {
  return (
    <div className="interpreter-alert">
      <div className="interpreter-alert__card">
        <div className="interpreter-alert__icon">
          <AlertTriangle size={40} />
        </div>
        <h2 className="interpreter-alert__title">Interpreter Required</h2>
        <p className="interpreter-alert__reason">
          {reason || 'High-risk encounter with language gap detected'}
        </p>
        <div className="interpreter-alert__status">
          <span className="interpreter-alert__dot" />
          AUTOMATIC SUMMONING IN PROGRESS
        </div>
        <button className="interpreter-alert__dismiss" onClick={onDismiss}>
          Continue Without Interpreter
        </button>
      </div>
    </div>
  );
}
