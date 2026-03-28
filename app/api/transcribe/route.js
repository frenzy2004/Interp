import { GoogleGenAI } from '@google/genai';
import { corsHeaders, jsonResponse, errorResponse } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Default ASR model if none specified
const DEFAULT_ASR_MODEL = 'gemini-2.5-flash';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const language = formData.get('language') || 'en';
    const asrModel = formData.get('model') || DEFAULT_ASR_MODEL;

    if (!file) {
      return errorResponse('No audio file provided', 400);
    }

    // Convert audio to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    // Gemini doesn't support ogg — remap to webm (same Opus codec underneath)
    const rawMime = file.type || 'audio/webm';
    const mimeType = rawMime.includes('ogg') ? 'audio/webm' : rawMime;

    const response = await ai.models.generateContent({
      model: asrModel,
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
    if (!text) {
      return errorResponse('Gemini returned empty transcription', 500);
    }

    return jsonResponse({ text, model: asrModel });
  } catch (error) {
    console.error('Transcription error:', error);
    return errorResponse(error.message || 'Transcription failed', 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
