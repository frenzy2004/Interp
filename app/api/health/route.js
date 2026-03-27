import { testConnection } from '@/lib/db.js';
import { corsHeaders, jsonResponse } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const startTime = Date.now();

  try {
    // Test database connection
    const dbTest = await testConnection();
    const duration = Date.now() - startTime;

    return jsonResponse({
      status: 'ok',
      database: dbTest.success ? 'connected' : 'failed',
      dbError: dbTest.error || null,
      responseTime: `${duration}ms`,
      environment: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    return jsonResponse({
      status: 'error',
      database: 'failed',
      error: error.message,
      responseTime: `${duration}ms`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
