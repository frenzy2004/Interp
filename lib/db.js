// Neon PostgreSQL Database Connection
// Uses @neondatabase/serverless for Vercel Edge/Serverless compatibility

import { neon } from '@neondatabase/serverless';

// Create a SQL query function using the DATABASE_URL
const sql = neon(process.env.DATABASE_URL);

// Execute a query against PostgreSQL
export async function query(sqlString, params = []) {
  try {
    console.log('Neon Executing:', sqlString);

    const result = await sql(sqlString, params);

    // For INSERT statements, return insertId info
    if (sqlString.trim().toUpperCase().startsWith('INSERT')) {
      // PostgreSQL RETURNING clause should be used, but for compatibility
      // we'll return the first row's id if available
      return {
        insertId: result[0]?.id || null,
        changes: result.length,
        rows: result,
      };
    }

    // For UPDATE/DELETE, return changes count
    if (sqlString.trim().toUpperCase().startsWith('UPDATE') || sqlString.trim().toUpperCase().startsWith('DELETE')) {
      return {
        affectedRows: result.length || 0,
        changes: result.length || 0,
        rows: result,
      };
    }

    // For SELECT, return the results array
    return result;
  } catch (error) {
    console.error(`Neon query error:`, error.message);
    throw error;
  }
}

// Test database connection
export async function testConnection() {
  try {
    const result = await sql`SELECT 1 as test`;
    return { success: true, result };
  } catch (error) {
    console.error('Neon connection test failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Execute multiple queries in a transaction
export async function transaction(queries) {
  try {
    // For Neon serverless, we execute queries sequentially
    // Full transaction support requires connection pooling
    const results = [];

    for (const { sql: sqlString, params } of queries) {
      const result = await query(sqlString, params || []);
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error('Neon transaction error:', error.message);
    throw error;
  }
}

// Helper to get pool-like interface for compatibility
export function getPool() {
  return {
    execute: async (sqlString, params) => {
      const result = await query(sqlString, params);
      return [result];
    },
  };
}

export default { query, transaction, getPool, testConnection };
