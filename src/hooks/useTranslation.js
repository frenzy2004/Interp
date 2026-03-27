"use client";
import { useState, useCallback } from 'react';
import { translateText, backTranslate, scoreComprehension } from '../utils/ai';
import { detectMedicalTags } from '../utils/medicalTags';

/**
 * useTranslation — manages the independent translation pipeline.
 * Translate → back-translate → score → detect medical tags.
 * Three separate LLM calls — the AI never grades its own homework.
 */
export function useTranslation() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState(null);

  const translate = useCallback(async (text, sourceLang, targetLang) => {
    if (!text?.trim()) return null;

    setIsTranslating(true);
    setError(null);

    try {
      // Step 1: Translate
      const translatedText = await translateText(text, sourceLang, targetLang);
      if (!translatedText) throw new Error('Translation failed');

      // Step 2: Back-translate (independent verification)
      const backTranslation = await backTranslate(translatedText, targetLang, sourceLang);

      // Step 3: Score (independent assessment)
      const scores = await scoreComprehension(text, backTranslation || '');

      // Step 4: Detect medical tags — run on both source and translated text
      // so Spanish/Tamil patient speech is caught via its English translation
      const medicalTags = [...new Set([
        ...detectMedicalTags(text),
        ...detectMedicalTags(translatedText),
      ])];

      return {
        translatedText,
        backTranslation: backTranslation || '',
        accuracyScore: scores.accuracyScore,
        comprehensionScore: scores.comprehensionScore,
        medicalTags,
        issues: scores.issues || [],
      };
    } catch (err) {
      console.error("Translation pipeline error:", err);
      setError(err.message);
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, []);

  return {
    translate,
    isTranslating,
    error,
  };
}
