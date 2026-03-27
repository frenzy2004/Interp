"use server";

import { GoogleGenAI } from '@google/genai';
import { detectMedicalTags } from './medicalTags.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3-flash-preview";

// ─── TRANSLATION (legacy single-call, kept as fallback) ─────────────────

export async function translateMedical(text, sourceLang, targetLang) {
  if (!text?.trim()) return null;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `You are a certified medical interpreter. Translate between ${sourceLang} and ${targetLang} with clinical precision.

Rules:
1. Translate the medical content accurately, preserving ALL clinical meaning.
2. Use culturally appropriate phrasing for the target language.
3. Do NOT simplify or omit medical terminology — translate it faithfully, then add a plain-language clarification in parentheses if the term is complex.
4. Preserve the speaker's tone (reassuring, urgent, questioning).
5. If a term has no direct equivalent, transliterate it and explain.
6. Also provide a back-translation (translate your output back to ${sourceLang}) for verification.
7. Rate your translation accuracy 0-100.
8. Rate the comprehension likelihood 0-100 (would an average patient/physician understand this?).

Return ONLY a JSON object:
{
  "translatedText": "...",
  "backTranslation": "...",
  "accuracyScore": number,
  "comprehensionScore": number,
  "medicalTermsFound": ["term1", "term2"]
}

Text to translate: ${text}`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text);
    const medicalTags = detectMedicalTags(text);

    return {
      translatedText: result.translatedText || '',
      backTranslation: result.backTranslation || '',
      accuracyScore: Math.min(100, Math.max(0, result.accuracyScore || 0)),
      comprehensionScore: Math.min(100, Math.max(0, result.comprehensionScore || 0)),
      medicalTags,
      medicalTermsFound: result.medicalTermsFound || [],
    };
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
}

// ─── INDEPENDENT TRANSLATION PIPELINE ───────────────────────────────────

/**
 * Step 1: Translate text from source to target language.
 * Medical-grade, preserves clinical meaning.
 */
export async function translateText(text, sourceLang, targetLang) {
  if (!text?.trim()) return null;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are a certified medical interpreter translating from ${sourceLang} to ${targetLang}.
Translate with clinical precision. Preserve ALL medical terminology — translate faithfully, add plain-language clarification in parentheses for complex terms. Preserve speaker tone. Keep cultural context appropriate.
Return ONLY the translated text, nothing else.

Text: ${text}`,
  });

  return response.text.trim();
}

/**
 * Step 2: Back-translate to verify meaning was preserved.
 */
export async function backTranslate(translatedText, fromLang, toLang) {
  if (!translatedText?.trim()) return null;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Translate the following ${fromLang} text back to ${toLang}.
Translate literally and faithfully — do NOT try to improve or correct the meaning.
This is a verification step. Return ONLY the translated text.

Text: ${translatedText}`,
  });

  return response.text.trim();
}

/**
 * Step 3: Score comprehension by comparing original vs back-translation.
 */
export async function scoreComprehension(originalText, backTranslation) {
  if (!originalText?.trim() || !backTranslation?.trim()) {
    return { accuracyScore: 0, comprehensionScore: 0 };
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are a medical translation quality assessor. Compare the ORIGINAL text with a BACK-TRANSLATION to assess how well meaning was preserved.

Score two dimensions:
- accuracyScore (0-100): How much of the original clinical meaning survived the round-trip translation? 100 = perfect preservation, 0 = completely lost.
- comprehensionScore (0-100): Would the target audience (patient or physician) understand the translated version? Consider medical literacy, cultural context, and complexity.

Be STRICT. Deduct heavily for:
- Lost medical terms (-15 each)
- Changed meaning (-20 each)
- Added information not in original (-10 each)
- Ambiguous phrasing that could be misunderstood (-10 each)

Return ONLY a JSON object: { "accuracyScore": number, "comprehensionScore": number, "issues": ["list of specific problems found"] }

ORIGINAL: ${originalText}

BACK-TRANSLATION: ${backTranslation}`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const result = JSON.parse(response.text);
  return {
    accuracyScore: Math.min(100, Math.max(0, result.accuracyScore || 0)),
    comprehensionScore: Math.min(100, Math.max(0, result.comprehensionScore || 0)),
    issues: result.issues || [],
  };
}

// ─── TTS (ElevenLabs) ────────────────────────────────────────────────────────

const ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — multilingual v2

export async function speakText(text) {
  if (!text?.trim()) return null;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs TTS error: ${err}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer).toString('base64');
}

// ─── ASR ────────────────────────────────────────────────────────────────────

export async function transcribeAudio(formData) {
  const file = formData.get('file');
  const language = formData.get('language') || 'en';

  if (!file) throw new Error("No audio file provided.");

  const arrayBuffer = await file.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString('base64');
  // Gemini doesn't support ogg — remap to webm (same Opus codec underneath)
  const rawMime = file.type || 'audio/webm';
  const mimeType = rawMime.includes('ogg') ? 'audio/webm' : rawMime;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Audio } },
          { text: `Transcribe this audio accurately. The speaker is using ${language}. Return ONLY the transcribed text, nothing else.` },
        ],
      },
    ],
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned empty transcription.");

  return { text, model: 'gemini-asr' };
}

// ─── VOICE TRANSCRIPT CLEANUP ───────────────────────────────────────────────

export async function processVoiceTranscript(text, knownTagIds = []) {
  if (!text?.trim()) return text;

  const tagRule = knownTagIds.length > 0
    ? `5. The speaker may use verbal commands to flag medical categories (e.g. "flag consent", "note allergy"). Known categories: ${knownTagIds.join(', ')}. Preserve these command phrases exactly — do NOT paraphrase or remove them.`
    : '';

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `You are a medical speech-to-text post-processor. Clean up voice-to-text output for a medical interpretation system.
1. Fix obvious ASR errors, stutters, and filler words (uh, um, like).
2. PRESERVE the original meaning and language exactly — do NOT translate or paraphrase.
3. Maintain medical terminology precisely.
4. Keep the original language of the input.${tagRule ? '\n' + tagRule : ''}
Return ONLY the cleaned text.

Input: ${text}`,
    });

    return response.text.trim() || text;
  } catch (error) {
    console.error("Voice cleanup error:", error);
    return text;
  }
}

// ─── COMPREHENSION CHECK ─────────────────────────────────────────────────────

export async function generateComprehensionQuestion(translatedText, patientLang) {
  if (!translatedText?.trim()) return null;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are a medical interpreter assistant. The physician just told the patient: "${translatedText}". Generate ONE short, plain-language question in ${patientLang} to verify the patient understood the critical point. The question must be answerable with a simple yes/no or brief rephrasing. Return ONLY a JSON object: { "question": string }`,
    config: { responseMimeType: 'application/json' },
  });

  const result = JSON.parse(response.text);
  return result.question;
}

export async function evaluateComprehensionResponse(originalText, question, patientResponse, patientLang) {
  if (!patientResponse?.trim()) return { understood: false, confidence: 0, reason: 'No response' };

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `A physician said: "${originalText}". We asked the patient in their language: "${question}". The patient responded (in ${patientLang}): "${patientResponse}". Did the patient demonstrate adequate understanding of the original message? Be strict — vague or non-committal answers count as fail. Return ONLY a JSON object: { "understood": boolean, "confidence": number, "reason": string }`,
    config: { responseMimeType: 'application/json' },
  });

  return JSON.parse(response.text);
}

export async function simplifyUtterance(text, targetLang) {
  if (!text?.trim()) return text;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Rewrite this medical statement in simpler language for a patient with low health literacy. Target language: ${targetLang}. Keep ALL critical medical meaning — only simplify the wording. Return ONLY the simplified text, nothing else.\n\nText: ${text}`,
  });

  return response.text.trim();
}
