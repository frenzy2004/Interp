import { authenticate, jsonResponse, errorResponse, corsHeaders } from '@/lib/auth.js';

export async function GET(req) {
  try {
    const { user, error } = await authenticate(req);

    if (error) {
      return errorResponse(error, 401);
    }

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

  } catch (error) {
    console.error('Auth check error:', error);
    return errorResponse('Authentication failed', 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
