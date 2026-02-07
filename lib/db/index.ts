import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create connection pool
// Note: DATABASE_URL should be set in runtime, but may not be available during build
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/placeholder',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Create drizzle instance
export const db = drizzle(pool, { schema });

// Export schema for use in queries
export * from './schema';
