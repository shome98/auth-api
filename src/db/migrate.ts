import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../config/env';

async function main() {
  const url = env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log('🔄 Running migrations...');
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('✅ Migrations completed successfully!');
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
