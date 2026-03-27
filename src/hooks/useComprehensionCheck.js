"use client";
import { useState, useRef, useCallback } from 'react';
import {
  generateComprehensionQuestion,
  evaluateComprehensionResponse,
  simplifyUtterance,
} from '../utils/ai';

/**
 * useComprehensionCheck — COCO-style patient comprehension check lifecycle.
 *
 * After a critical utterance is delivered, initiateCheck() generates a
 * verification question in the patient's language. When the patient responds
 * verbally, handleCheckResponse() evaluates understanding and optionally
 * generates a simplified rephrasing.
 */
export function useComprehensionCheck({ updateUtterance, patientLang }) {
  const [pendingCheckId, setPendingCheckId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Snapshot of the utterance that triggered the check
  const pendingUtteranceRef = useRef(null);
  const pendingCheckIdRef = useRef(null);

  // Keep ref in sync with state for use inside callbacks
  const setPending = useCallback((id, utterance) => {
    setPendingCheckId(id);
    pendingCheckIdRef.current = id;
    pendingUtteranceRef.current = utterance ?? null;
  }, []);

  const initiateCheck = useCallback(async (utterance) => {
    if (!utterance?.translatedText) return;

    setIsGenerating(true);
    try {
      const question = await generateComprehensionQuestion(utterance.translatedText, patientLang);
      if (!question) return;

      updateUtterance(utterance.id, {
        comprehensionCheck: {
          question,
          status: 'pending',
          patientResponse: '',
          simplifiedVersion: '',
        },
      });

      setPending(utterance.id, utterance);
    } catch (err) {
      console.error('Comprehension check generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [patientLang, updateUtterance, setPending]);

  const handleCheckResponse = useCallback(async (patientResponseText) => {
    const id = pendingCheckIdRef.current;
    const utterance = pendingUtteranceRef.current;
    if (!id || !utterance) return;

    // Clear pending immediately so patient mic returns to normal
    setPending(null, null);

    try {
      const eval_ = await evaluateComprehensionResponse(
        utterance.originalText,
        utterance.comprehensionCheck?.question ?? '',
        patientResponseText,
        patientLang
      );

      if (eval_.understood) {
        updateUtterance(id, {
          comprehensionCheck: {
            question: utterance.comprehensionCheck?.question ?? '',
            status: 'pass',
            patientResponse: patientResponseText,
            simplifiedVersion: '',
          },
        });
      } else {
        // Generate simplified rephrasing in patient's language
        let simplified = '';
        try {
          simplified = await simplifyUtterance(utterance.translatedText, patientLang);
        } catch (e) {
          console.error('Simplification failed:', e);
        }

        updateUtterance(id, {
          comprehensionCheck: {
            question: utterance.comprehensionCheck?.question ?? '',
            status: 'fail',
            patientResponse: patientResponseText,
            simplifiedVersion: simplified,
          },
        });
      }
    } catch (err) {
      console.error('Comprehension evaluation failed:', err);
      // On error, mark as skipped so session isn't stuck
      updateUtterance(id, {
        comprehensionCheck: {
          question: utterance.comprehensionCheck?.question ?? '',
          status: 'skipped',
          patientResponse: patientResponseText,
          simplifiedVersion: '',
        },
      });
    }
  }, [patientLang, updateUtterance, setPending]);

  const dismissCheck = useCallback(() => {
    const id = pendingCheckIdRef.current;
    const utterance = pendingUtteranceRef.current;
    if (!id) return;

    updateUtterance(id, {
      comprehensionCheck: {
        question: utterance?.comprehensionCheck?.question ?? '',
        status: 'skipped',
        patientResponse: '',
        simplifiedVersion: '',
      },
    });

    setPending(null, null);
  }, [updateUtterance, setPending]);

  return {
    pendingCheckId,
    isGenerating,
    initiateCheck,
    handleCheckResponse,
    dismissCheck,
  };
}
