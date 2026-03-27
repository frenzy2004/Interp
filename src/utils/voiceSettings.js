"use client";

// Voice Settings Manager for Taskwind
// Handles voice model preference with local storage persistence

export const VOICE_MODELS = {
  PREVIEW: 'ilmu-preview-asr',
  STANDARD: 'ILMU-asr',
  BROWSER: 'WebSpeech'
};

export const VOICE_MODEL_LABELS = {
  [VOICE_MODELS.PREVIEW]: 'ILMU Preview (Fastest)',
  [VOICE_MODELS.STANDARD]: 'ILMU Standard (Accurate)',
  [VOICE_MODELS.BROWSER]: 'Browser Native'
};

class VoiceSettings {
  constructor() {
    this.defaultModel = VOICE_MODELS.BROWSER;
    this.model = this.defaultModel;
  }

  getModel() {
    return this.model || this.defaultModel;
  }

  setModel(model) {
    this.model = model;
    // Dispatch a custom event so other components can react if needed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('taskwind:voiceModelChanged', { detail: { model } }));
    }
  }
}

export const voiceSettings = new VoiceSettings();
export default voiceSettings;
