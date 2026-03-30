import { corsHeaders, jsonResponse, errorResponse } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — neutral, multilingual
const ELEVENLABS_MODEL = 'eleven_multilingual_v2';

export async function POST(req) {
  try {
    const { text, language } = await req.json();

    if (!text?.trim()) {
      return errorResponse('No text provided', 400);
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return errorResponse('ElevenLabs API key not configured', 500);
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('ElevenLabs error:', err);
      return errorResponse('TTS generation failed', 500);
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        ...corsHeaders(),
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return errorResponse(error.message || 'TTS failed', 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
