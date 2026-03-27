import { query } from '@/lib/db.js';
import { verifyPassword, generateToken, jsonResponse, errorResponse, corsHeaders } from '@/lib/auth.js';

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    // Find user
    const users = await query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (users.length === 0) {
      return errorResponse('Invalid email or password', 401);
    }

    const user = users[0];

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return errorResponse('Invalid email or password', 401);
    }

    // Update last login (fire and forget, max 1s wait)
    try {
      // Race against a short timeout
      await Promise.race([
        query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Update timed out')), 1000))
      ]);
    } catch (updateError) {
      // Ignore update errors (timeout or database failure) to keep login fast
      console.warn('Skipping last_login_at update:', updateError.message);
    }

    // Generate token
    const token = generateToken(user);

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });

  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Login failed. Please try again.', 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
