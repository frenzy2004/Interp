import { query } from '@/lib/db.js';
import { hashPassword, generateToken, jsonResponse, errorResponse, corsHeaders } from '@/lib/auth.js';

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    // Validate input
    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters');
    }

    // Check if user already exists
    const existingUsers = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUsers.length > 0) {
      return errorResponse('Email already registered');
    }

    // Hash password and create user
    console.log('Hashing password...');
    const hashedPassword = await hashPassword(password);

    console.log('Creating user in DB...');
    const result = await query(
      "INSERT INTO users (email, password_hash, name, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id",
      [email.toLowerCase(), hashedPassword, name || null]
    );
    const insertedId = result[0]?.id || result.insertId;
    console.log('User created:', insertedId);

    const user = {
      id: insertedId,
      email: email.toLowerCase(),
      name: name || null,
    };

    // Generate token
    const token = generateToken(user);

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token,
    }, 201);

  } catch (error) {
    console.error('Registration error:', error);
    return errorResponse('Registration failed. Please try again.', 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
