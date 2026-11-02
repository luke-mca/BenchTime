import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from '../src/config.js';

if (config.env !== 'test') {
  console.error('Refusing to reset the database because NODE_ENV is not "test". Run this with .env.test.');
  process.exit(1);
}

const databaseUrl = new URL(config.databaseUrl);
const databaseName = databaseUrl.pathname.replace('/', '');

async function createDatabaseIfMissing() {
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();

  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE ${pg.escapeIdentifier(databaseName)}`);
      console.log(`Created database ${databaseName}.`);
    }
  } finally {
    await client.end();
  }
}

function migrate() {
  const migrateScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrate.js');
  execFileSync(process.execPath, [migrateScript], { stdio: 'inherit', env: process.env });
}

async function clearTables() {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();

  try {
    await client.query('TRUNCATE reservations, equipment, memberships, labs, users RESTART IDENTITY CASCADE');
    console.log(`Cleared all tables in ${databaseName}.`);
  } finally {
    await client.end();
  }
}

await createDatabaseIfMissing();
migrate();
await clearTables();
