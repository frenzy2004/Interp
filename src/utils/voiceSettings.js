"use client";

// Voice Settings Manager for Interp
// Handles voice model preference with localStorage persistence

export const VOICE_MODELS = {
  FASTEST: 'gemini-2.0-flash',
  STANDARD: 'gemini-2.5-flash',
  ACCURATE: 'gemini-3-flash-preview',
  BROWSER: 'WebSpeech'
};

export const VOICE_MODEL_LABELS = {
  [VOICE_MODELS.FASTEST]: 'Gemini 2.0 Flash (Fastest)',
  [VOICE_MODELS.STANDARD]: 'Gemini 2.5 Flash (Balanced)',
  [VOICE_MODELS.ACCURATE]: 'Gemini 3 Flash (Most Accurate)',
  [VOICE_MODELS.BROWSER]: 'Browser Native (Offline)'
};

export const VOICE_MODEL_DESCRIPTIONS = {
  [VOICE_MODELS.FASTEST]: 'Quick capture, lower cost',
  [VOICE_MODELS.STANDARD]: 'Good accuracy, fast response',
  [VOICE_MODELS.ACCURATE]: 'Best quality transcription',
  [VOICE_MODELS.BROWSER]: 'Free, works offline'
};

const STORAGE_KEY = 'interp_voice_model';
const VALID_MODELS = Object.values(VOICE_MODELS);

class VoiceSettings {
  constructor() {
    this.defaultModel = VOICE_MODELS.STANDARD;
    this.model = this._loadModel();
  }

  _loadModel() {
    if (typeof window === 'undefined') return this.defaultModel;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && VALID_MODELS.includes(stored) ? stored : this.defaultModel;
    } catch {
      return this.defaultModel;
    }
  }

  getModel() {
    return this.model || this.defaultModel;
  }

  setModel(model) {
    if (!VALID_MODELS.includes(model)) return;
    this.model = model;
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, model); } catch {}
      window.dispatchEvent(new CustomEvent('interp:voiceModelChanged', { detail: { model } }));
    }
  }
}

export const voiceSettings = new VoiceSettings();
export default voiceSettings;
