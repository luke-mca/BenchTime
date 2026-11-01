import path from 'node:path';
import { fileURLToPath } from 'node:url';

const authDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth');

export const API_URL = 'http://localhost:3001';
export const CLIENT_URL = 'http://localhost:5174';
export const PASSWORD = 'viewport-test-pass';

export const paths = {
  dir: authDir,
  manager: path.join(authDir, 'manager.json'),
  member: path.join(authDir, 'member.json'),
  data: path.join(authDir, 'data.json'),
};
