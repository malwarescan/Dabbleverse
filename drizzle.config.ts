import type { Config } from 'drizzle-kit';
import path from 'path';
import { config } from 'dotenv';

// Load .env.local first so db:push works when you have a local DB or copied production URL
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/placeholder',
  },
} satisfies Config;
