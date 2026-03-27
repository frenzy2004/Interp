import { query } from '../../../lib/db';
import { authenticate, jsonResponse, errorResponse, corsHeaders } from '../../../lib/auth';

// GET /api/sessions — list user's sessions
export async function GET(request) {
  try {
    const { user, error } = await authenticate(request);
    if (!user) return errorResponse(error || 'Unauthorized', 401);

    const sessions = await query(
      `SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [user.id]
    );

    return jsonResponse({ sessions });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

// POST /api/sessions — create a new session
export async function POST(request) {
  try {
    const { user, error } = await authenticate(request);
    if (!user) return errorResponse(error || 'Unauthorized', 401);

    const body = await request.json();
    const { localId, physicianLang, patientLang, encounterType, department } = body;

    const result = await query(
      `INSERT INTO sessions (user_id, local_id, physician_lang, patient_lang, encounter_type, department)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.id, localId, physicianLang || 'en', patientLang || 'es', encounterType || 'outpatient', department || '']
    );

    return jsonResponse({ session: result.rows?.[0] || result[0] }, 201);
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
