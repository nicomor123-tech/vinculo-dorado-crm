import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const PROJECT_REF = 'aprydldykaikaftxqpwq';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcnlkbGR5a2Fpa2FmdHhxcHdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYxNTc0MywiZXhwIjoyMDkwMTkxNzQzfQ.NMQ100c2THzqYcORjR10I5HrtTOGPcjYEtHq5ya37Z8';

// Direct DB connection - Supabase accepts service_role JWT as password for the postgres user
const client = new Client({
  host: `db.${PROJECT_REF}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: SERVICE_ROLE_KEY,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'supabase', 'migrations');

async function run() {
  console.log('🔌 Conectando a Supabase PostgreSQL...');

  try {
    await client.connect();
    console.log('✅ Conexión exitosa\n');
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    process.exit(1);
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`📁 Ejecutando ${files.length} migraciones...\n`);

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf8');
    try {
      await client.query(sql);
      console.log(`✅ ${file}`);
    } catch (err) {
      // Ignore "already exists" errors from idempotent migrations
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log(`⚠️  ${file} (ya existía, ignorado)`);
      } else {
        console.error(`❌ ${file}: ${err.message}`);
        // Continue anyway for non-fatal errors
      }
    }
  }

  await client.end();
  console.log('\n🎉 Migraciones completadas!');
}

run().catch(console.error);
