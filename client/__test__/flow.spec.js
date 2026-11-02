import { test, expect as baseExpect } from '@playwright/test';
import { PASSWORD } from './testData.js';

//This flow takes many steps on a dev server, so each step gets longer than the default 5 seconds.
const expect = baseExpect.configure({ timeout: 15_000 });

//The core flow through the real UI, server and test database. Only runs at phone and desktop sizes
//because viewport.spec.js already checks the layout on every device.
const FLOW_PROJECTS = ['mobile', 'desktop'];

//Value for a datetime-local input, in the browser's local time.
function localInputValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function register(page, username, roleLabel) {
  await page.goto('/register');
  await page.getByRole('radio', { name: new RegExp(roleLabel) }).check();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page.getByRole('heading', { name: 'Your labs' })).toBeVisible();
}

async function logIn(page, username) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('main').getByRole('button', { name: 'Log In' }).click();
  await expect(page.getByRole('button', { name: 'Log Out' })).toBeVisible();
  //Logging in can return to the last lab page, so go home to start from the same place every time.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your labs' })).toBeVisible();
}

async function logOut(page) {
  await page.getByRole('button', { name: 'Log Out' }).click();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Log In' })).toBeVisible();
}

test('a manager sets up a lab and a member reserves equipment', async ({ page }, testInfo) => {
  test.skip(!FLOW_PROJECTS.includes(testInfo.project.name), 'Runs at phone and desktop sizes only.');
  test.slow();

  //Every device shares one database, so names are unique per device.
  const managerName = `flow_manager_${testInfo.project.name}`;
  const memberName = `flow_member_${testInfo.project.name}`;
  const labName = `Flow Lab ${testInfo.project.name}`;

  //The member needs an account before the manager can add them.
  await register(page, memberName, 'Member');
  await logOut(page);

  await register(page, managerName, 'Lab Manager');

  await page.getByRole('button', { name: 'Create lab' }).click();
  await page.getByLabel('Lab name').fill(labName);
  await page.getByRole('button', { name: 'Create Lab' }).click();

  await page.getByRole('link', { name: labName }).click();
  await expect(page).toHaveURL(/\/labs\/\d+$/);
  await expect(page.getByRole('heading', { name: labName })).toBeVisible();

  await page.getByRole('button', { name: 'Add equipment' }).click();
  await page.getByLabel('Equipment name').fill('Microscope');
  await page.getByRole('button', { name: 'Add Equipment' }).click();
  //This button only exists on a saved row, so leftover form text cannot make the check pass.
  await expect(page.getByRole('button', { name: 'Remove Microscope' })).toBeVisible();

  await page.getByRole('button', { name: 'Add member' }).click();
  await page.getByLabel('Member username').fill(memberName);
  await page.getByRole('button', { name: 'Add Member' }).click();
  await expect(page.getByRole('button', { name: `Remove ${memberName}` })).toBeVisible();

  await logOut(page);

  await logIn(page, memberName);
  await page.getByRole('link', { name: labName }).click();
  await expect(page.getByRole('heading', { name: labName })).toBeVisible();

  await page.getByRole('button', { name: 'Reserve' }).click();
  await page.getByLabel('Start').fill(localInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  await page.getByRole('button', { name: 'Reserve', exact: true }).click();
  await expect(page.getByText('You', { exact: true })).toBeVisible();

  await logOut(page);

  //The manager sees the member's reservation, which proves it was really saved.
  await logIn(page, managerName);
  await page.getByRole('link', { name: labName }).click();
  await page.getByRole('button', { name: 'Reserve' }).click();
  await expect(page.getByRole('button', { name: `Remove ${memberName}'s reservation` })).toBeVisible();
});
