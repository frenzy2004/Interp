"use client";

const STORAGE_KEY = 'interp_tts_enabled';

class TtsSettings {
  constructor() {
    this.enabled = this._load();
  }

  _load() {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(val) {
    this.enabled = val;
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, String(val)); } catch {}
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }
}

export const ttsSettings = new TtsSettings();
export default ttsSettings;
