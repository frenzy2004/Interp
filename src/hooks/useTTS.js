"use client";
import { useState, useCallback } from 'react';
import { ttsSettings } from '../utils/ttsSettings';

export function useTTS() {
  const [ttsEnabled, setTtsEnabled] = useState(() => ttsSettings.isEnabled());

  const toggleTTS = useCallback(() => {
    const next = ttsSettings.toggle();
    setTtsEnabled(next);
  }, []);

  const speak = useCallback(async (text, language) => {
    if (!ttsSettings.isEnabled() || !text?.trim()) return;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });
      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play();
    } catch (err) {
      console.warn('TTS speak failed:', err.message);
    }
  }, []);

  return { ttsEnabled, toggleTTS, speak };
}
