import { query } from '../../../../lib/db';
import { authenticate, jsonResponse, errorResponse, corsHeaders } from '../../../../lib/auth';

// GET /api/sessions/:id
export async function GET(request, { params }) {
  try {
    const { user, error } = await authenticate(request);
    if (!user) return errorResponse(error || 'Unauthorized', 401);

    const { id } = await params;

    const sessions = await query(
      `SELECT * FROM sessions WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );

    const session = sessions[0];
    if (!session) return errorResponse('Not found', 404);

    const utterances = await query(
      `SELECT * FROM utterances WHERE session_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    return jsonResponse({ session, utterances });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

// PUT /api/sessions/:id — update session (status, scores, etc.)
export async function PUT(request, { params }) {
  try {
    const { user, error } = await authenticate(request);
    if (!user) return errorResponse(error || 'Unauthorized', 401);

    const { id } = await params;
    const body = await request.json();
    const { status, avgComprehension, avgAccuracy, escalationReason } = body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (status) { updates.push(`status = $${paramIndex++}`); values.push(status); }
    if (avgComprehension !== undefined) { updates.push(`avg_comprehension = $${paramIndex++}`); values.push(avgComprehension); }
    if (avgAccuracy !== undefined) { updates.push(`avg_accuracy = $${paramIndex++}`); values.push(avgAccuracy); }
    if (status === 'escalated') {
      updates.push(`escalated_at = NOW()`);
      if (escalationReason) { updates.push(`escalation_reason = $${paramIndex++}`); values.push(escalationReason); }
    }
    if (status === 'completed') { updates.push(`completed_at = NOW()`); }

    updates.push(`updated_at = NOW()`);
    values.push(id, user.id);

    const result = await query(
      `UPDATE sessions SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING *`,
      values
    );

    return jsonResponse({ session: result.rows?.[0] || result[0] });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
