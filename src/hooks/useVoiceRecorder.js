"use client";
import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudio, processVoiceTranscript } from '../utils/ai';
import { voiceSettings, VOICE_MODELS } from '../utils/voiceSettings';
import { applyVoiceTagging, MEDICAL_TAG_IDS } from '../utils/voiceTagging';

/**
 * useVoiceRecorder — handles mic recording, ASR transcription, and cleanup.
 * Extracted from Taskwind's QuickCapture component.
 *
 * Returns: { isRecording, isProcessing, startRecording, stopRecording, toggleRecording, lastTranscript, error }
 */
export function useVoiceRecorder({ language = 'en', onTranscript, isAuthenticated = false } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioFormatRef = useRef('ogg');
  const shouldRecordRef = useRef(false);
  const streamRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (isProcessing) return;
    if (mediaRecorderRef.current?.state === 'recording') return;

    // Browser WebSpeech fallback
    if (voiceSettings.getModel() === VOICE_MODELS.BROWSER) {
      startWebSpeech();
      return;
    }

    shouldRecordRef.current = true;
    setIsRecording(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (!shouldRecordRef.current) {
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        return;
      }

      // Detect best supported format
      let mimeType = 'audio/ogg; codecs=opus';
      let fileExtension = 'ogg';

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        fileExtension = 'm4a';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/wav';
          fileExtension = 'wav';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm; codecs=opus';
            fileExtension = 'webm';
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      audioFormatRef.current = fileExtension;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const ext = audioFormatRef.current || 'ogg';
        const mime = ext === 'ogg' ? 'audio/ogg' : ext === 'wav' ? 'audio/wav' : ext === 'm4a' ? 'audio/mp4' : 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("Mic access error:", err);
      setIsRecording(false);
      setError(err.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Could not access microphone');
    }
  }, [isProcessing]);

  const stopRecording = useCallback(() => {
    shouldRecordRef.current = false;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  // WebSpeech fallback
  const startWebSpeech = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const result = { text: transcript, model: 'WebSpeech', cleaned: transcript };
          setLastTranscript(result);
          onTranscript?.(result);
        }
      };

      recognition.onerror = () => { setIsRecording(false); setIsProcessing(false); };
      recognition.onend = () => { setIsRecording(false); };

      recognition.start();
      mediaRecorderRef.current = { stop: () => recognition.stop(), state: 'recording' };
      setIsRecording(true);
    } catch (err) {
      setError('WebSpeech failed');
      setIsRecording(false);
    }
  }, [language, onTranscript]);

  // Process recorded audio through ASR + cleanup pipeline
  const processAudio = useCallback(async (audioBlob) => {
    setIsProcessing(true);
    setError(null);

    try {
      // 1. Transcribe via ILMU ASR
      const formData = new FormData();
      const ext = audioFormatRef.current || 'ogg';
      formData.append('file', audioBlob, `voice-input.${ext}`);
      formData.append('language', language);

      const preferredModel = voiceSettings.getModel();
      if (preferredModel && preferredModel !== VOICE_MODELS.BROWSER) {
        formData.append('model', preferredModel);
      }

      const asrResult = await transcribeAudio(formData);

      if (!asrResult?.text?.trim()) {
        setIsProcessing(false);
        return;
      }

      // 2. Clean up ASR output (preserve verbal tag commands)
      const cleanedText = await processVoiceTranscript(asrResult.text, MEDICAL_TAG_IDS);

      // 3. Strip verbal tag commands, collect detected tag IDs
      const { text: taggedText, tags: voiceTags } = applyVoiceTagging(cleanedText || asrResult.text);

      const result = {
        text: asrResult.text,
        cleaned: taggedText,
        model: asrResult.model,
        voiceTags,
      };

      setLastTranscript(result);
      onTranscript?.(result);
    } catch (err) {
      console.error("Voice processing error:", err);
      setError('Transcription failed');
    } finally {
      setIsProcessing(false);
    }
  }, [language, onTranscript]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    toggleRecording,
    lastTranscript,
    error,
  };
}
