import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import Postgrator from 'postgrator';
import { config } from '../src/config.js';
//File for migrating the .sql files using postgrator. 

const MIGRATIONS_GLOB = path
  .join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations', '*')
  .split(path.sep)
  .join('/');

const databaseName = new URL(config.databaseUrl).pathname.replace('/', '');

const targetVersion = process.argv[2];

async function migrate() {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();

  const postgrator = new Postgrator({
    migrationPattern: MIGRATIONS_GLOB,
    driver: 'pg',
    database: databaseName,
    schemaTable: 'schema_migrations',
    validateChecksums: false,
    execQuery: (query) => client.query(query),
  });

  postgrator.on('migration-started', (migration) =>
    console.log(`Applying ${migration.filename}`),
  );

  try {
    const applied = await postgrator.migrate(targetVersion);
    const version = await postgrator.getDatabaseVersion();

    if (applied.length === 0) {
      console.log(`Database is at version ${version}.`);
    } else {
      console.log(`Performed ${applied.length} migration(s) now at version ${version}.`);
    }
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(`\nMigration failed: ${error.message}`);
  if (error.code) console.error(`PostgreSQL code: ${error.code}`);
  if (error.appliedMigrations?.length) {
    console.error(`Applied before failing: ${error.appliedMigrations.join(', ')}`);
  }
  process.exitCode = 1;
});
