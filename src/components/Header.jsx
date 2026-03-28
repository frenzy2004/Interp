"use client";
import { Pause, Play, Square, Plus, User, LogIn, Sun, Moon } from 'lucide-react';
import './Header.css';

export default function Header({
  onOpenAuth,
  isAuthenticated = false,
  sessionActive = false,
  onEndSession,
  onPauseSession,
  isPaused = false,
  onNewSession,
  theme,
  onToggleTheme,
}) {
  return (
    <header className="interp-header">
      <div className="interp-header__left">
        <div className="interp-header__brand">
          <img src="/interp-logo.svg" alt="interp" className="interp-header__logo-img" />
          <span className="interp-header__tagline">Beyond translation</span>
        </div>
      </div>

      <div className="interp-header__right">
        {onToggleTheme && (
          <button className="interp-header__btn" onClick={onToggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}

        {sessionActive && (
          <>
            <button className="interp-header__btn" onClick={onPauseSession} title={isPaused ? 'Resume' : 'Pause'}>
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button className="interp-header__btn interp-header__btn--danger" onClick={onEndSession} title="End session">
              <Square size={16} />
              <span>End</span>
            </button>
          </>
        )}

        {onNewSession && (
          <button className="interp-header__btn interp-header__btn--primary" onClick={onNewSession}>
            <Plus size={16} />
            <span>New Session</span>
          </button>
        )}

        {!isAuthenticated ? (
          <button className="interp-header__btn" onClick={onOpenAuth}>
            <LogIn size={16} />
            <span>Sign In</span>
          </button>
        ) : (
          <div className="interp-header__avatar">
            <User size={16} />
          </div>
        )}
      </div>
    </header>
  );
}
