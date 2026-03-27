import { query } from '../../../../../lib/db';
import { authenticate, jsonResponse, errorResponse, corsHeaders } from '../../../../../lib/auth';

// POST /api/sessions/:id/utterances — add an utterance
export async function POST(request, { params }) {
  try {
    const { user, error } = await authenticate(request);
    if (!user) return errorResponse(error || 'Unauthorized', 401);

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

    // Also log to audit
    await query(
      `INSERT INTO audit_log (session_id, event_type, event_data, actor_id)
       VALUES ($1, 'utterance', $2, $3)`,
      [id, JSON.stringify({ utteranceId: result.rows?.[0]?.id, role: body.role, accuracyScore: body.accuracyScore }), user.id]
    );

    return jsonResponse({ utterance: result.rows?.[0] || result[0] }, 201);
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
