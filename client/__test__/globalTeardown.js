import fs from 'node:fs/promises';
import { paths } from './testData.js';
import { resetDb } from './resetDb.js';

export default async function globalTeardown() {
  resetDb();
  await fs.rm(paths.dir, { recursive: true, force: true });
}
