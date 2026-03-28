import { query } from '../../../../../lib/db';
import { authenticate, jsonResponse, errorResponse, corsHeaders } from '../../../../../lib/auth';

// POST /api/sessions/:id/utterances — add an utterance (works with or without auth)
export async function POST(request, { params }) {
  try {
    const { user } = await authenticate(request);

    const { id } = await params;
    const body = await request.json();

    const result = await query(
      `INSERT INTO utterances (session_id, role, original_text, translated_text, back_translation, 
       source_lang, target_lang, accuracy_score, comprehension_score, medical_tags, flagged, flag_reason, asr_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id, body.role, body.originalText, body.translatedText || null,
        body.backTranslation || null, body.sourceLang, body.targetLang,
        body.accuracyScore || null, body.comprehensionScore || null,
        JSON.stringify(body.medicalTags || []), body.flagged || false,
        body.flagReason || null, body.asrModel || null
      ]
    );

    const utterance = result.rows?.[0] || result[0];

    // Also log to audit
    await query(
      `INSERT INTO audit_log (session_id, event_type, event_data, actor_id)
       VALUES ($1, 'utterance', $2, $3)`,
      [id, JSON.stringify({ utteranceId: utterance?.id, role: body.role, accuracyScore: body.accuracyScore }), user?.id || null]
    );

    // Save to translation memory (only when translation is complete)
    if (body.translatedText && body.accuracyScore != null) {
      try {
        await query(
          `INSERT INTO translation_memory (source_text, translated_text, back_translation, source_lang, target_lang,
           accuracy_score, comprehension_score, medical_tags, issues, asr_model, session_id, utterance_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            body.originalText, body.translatedText, body.backTranslation || null,
            body.sourceLang, body.targetLang,
            body.accuracyScore, body.comprehensionScore || null,
            JSON.stringify(body.medicalTags || []), JSON.stringify(body.issues || []),
            body.asrModel || null, id, utterance?.id
          ]
        );
      } catch (tmErr) {
        // Translation memory save is non-critical — log and continue
        console.warn('Translation memory insert failed:', tmErr.message);
      }
    }

    return jsonResponse({ utterance }, 201);
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
