import fs from 'node:fs/promises';
import { request } from '@playwright/test';
import { API_URL, PASSWORD, paths } from './testData.js';
import { resetDb } from './resetDb.js';

async function call(context, method, url, data) {
  const response = await context.fetch(url, { method, data });
  if (!response.ok()) {
    throw new Error(`${method} ${url} failed with ${response.status()}: ${await response.text()}`);
  }
  return response.json();
}

function hoursFromNow(hours) {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export default async function globalSetup() {
  resetDb();

  const managerName = 'viewport_manager';
  const memberName = 'viewport_member';

  const manager = await request.newContext({ baseURL: API_URL });
  const member = await request.newContext({ baseURL: API_URL });

  await call(manager, 'POST', '/api/auth/register', { username: managerName, password: PASSWORD, role: 'manager' });
  await call(member, 'POST', '/api/auth/register', { username: memberName, password: PASSWORD, role: 'member' });

  const { lab } = await call(manager, 'POST', '/api/labs', { name: 'Spectroscopy Lab' });
  await call(manager, 'POST', `/api/labs/${lab.id}/members`, { username: memberName });

  const { equipment: spectrometer } = await call(manager, 'POST', `/api/labs/${lab.id}/equipment`, {
    name: 'FTIR Spectrometer',
    description: 'Bruker Alpha II.\nBook at least 30 minutes.',
  });
  await call(manager, 'POST', `/api/labs/${lab.id}/equipment`, { name: 'UV-Vis Spectrophotometer', description: '' });

  const reservationsUrl = `/api/labs/${lab.id}/equipment/${spectrometer.id}/reservations`;
  await call(member, 'POST', reservationsUrl, { startTime: hoursFromNow(26), endTime: hoursFromNow(28) });
  await call(manager, 'POST', reservationsUrl, { startTime: hoursFromNow(50), endTime: hoursFromNow(51) });

  await fs.mkdir(paths.dir, { recursive: true });
  await manager.storageState({ path: paths.manager });
  await member.storageState({ path: paths.member });
  await fs.writeFile(paths.data, JSON.stringify({ labId: lab.id, labName: lab.name, managerName, memberName }));

  await manager.dispose();
  await member.dispose();
}
