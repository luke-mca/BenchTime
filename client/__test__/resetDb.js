import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'server');

export function resetDb() {
  execSync('npm run db:reset:test', { cwd: serverDir, stdio: 'inherit' });
}
