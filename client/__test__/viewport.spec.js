import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { paths } from './testData.js';

const data = JSON.parse(fs.readFileSync(paths.data, 'utf8'));

async function expectNoHorizontalOverflow(page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'page should not scroll sideways').toBeLessThanOrEqual(innerWidth);
}

async function expectWithinViewport(page, locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const { width } = page.viewportSize();
  expect(box.x, 'left edge should be on screen').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'right edge should be on screen').toBeLessThanOrEqual(width);
}

test.describe('signed out', () => {
  test('landing page fits the screen', async ({ page }) => {
    await page.goto('/');
    await expectWithinViewport(page, page.getByRole('heading', { level: 1 }));
    await expectWithinViewport(page, page.getByRole('main').getByRole('link', { name: 'Sign Up' }));
    await expectWithinViewport(page, page.getByRole('main').getByRole('link', { name: 'Log In' }));
    await expectWithinViewport(page, page.getByRole('navigation'));
    await expectNoHorizontalOverflow(page);
  });

  test('login form fits the screen', async ({ page }) => {
    await page.goto('/login');
    await expectWithinViewport(page, page.getByLabel('Username'));
    await expectWithinViewport(page, page.getByLabel('Password'));
    await expectWithinViewport(page, page.getByRole('main').getByRole('button', { name: 'Log In' }));
    await expectNoHorizontalOverflow(page);
  });

  test('register form fits the screen', async ({ page }) => {
    await page.goto('/register');
    await expectWithinViewport(page, page.getByLabel('Username'));
    await expectWithinViewport(page, page.getByRole('main').getByRole('button', { name: 'Sign Up' }));
    for (const radio of await page.getByRole('radio').all()) {
      await expectWithinViewport(page, radio);
    }
    await expectNoHorizontalOverflow(page);
  });

  test('not found page fits the screen', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expectWithinViewport(page, page.getByRole('heading', { name: 'Page not found' }));
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('signed in as a manager', () => {
  test.use({ storageState: paths.manager });

  test('home page fits the screen', async ({ page }) => {
    await page.goto('/');
    await expectWithinViewport(page, page.getByRole('link', { name: data.labName }));
    await expectWithinViewport(page, page.getByRole('button', { name: `Delete ${data.labName}` }));
    await expectWithinViewport(page, page.getByRole('button', { name: 'Log Out' }));
    await expectNoHorizontalOverflow(page);
  });

  test('create lab form fits the screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create lab' }).click();
    await expectWithinViewport(page, page.getByLabel('Lab name'));
    await expectWithinViewport(page, page.getByRole('button', { name: 'Create Lab' }));
    await expectNoHorizontalOverflow(page);
  });

  test('lab page fits the screen', async ({ page }) => {
    await page.goto(`/labs/${data.labId}`);
    await expectWithinViewport(page, page.getByRole('heading', { name: data.labName }));
    await expectWithinViewport(page, page.getByRole('heading', { name: 'Equipment' }));
    await expectWithinViewport(page, page.getByRole('heading', { name: 'Members' }));
    await expectWithinViewport(page, page.getByRole('button', { name: `Remove ${data.memberName}` }));
    await expect(page.getByRole('table')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('reservation schedule fits the screen', async ({ page }) => {
    await page.goto(`/labs/${data.labId}`);
    await page.getByRole('button', { name: 'Reserve' }).first().click();
    await expectWithinViewport(page, page.getByRole('heading', { name: 'Upcoming reservations' }));
    await expectWithinViewport(page, page.getByRole('button', { name: 'Edit' }).first());
    await expectWithinViewport(page, page.getByRole('button', { name: 'Reserve', exact: true }).last());
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('signed in as a member', () => {
  test.use({ storageState: paths.member });

  test('home page fits the screen', async ({ page }) => {
    await page.goto('/');
    await expectWithinViewport(page, page.getByRole('link', { name: data.labName }));
    await expectWithinViewport(page, page.getByRole('button', { name: 'Log Out' }));
    await expectNoHorizontalOverflow(page);
  });

  test('lab page and schedule fit the screen', async ({ page }) => {
    await page.goto(`/labs/${data.labId}`);
    await expectWithinViewport(page, page.getByRole('heading', { name: data.labName }));
    await page.getByRole('button', { name: 'Reserve' }).first().click();
    await expectWithinViewport(page, page.getByRole('heading', { name: 'Upcoming reservations' }));
    await expectWithinViewport(page, page.getByRole('button', { name: 'Reserve', exact: true }).last());
    await expectNoHorizontalOverflow(page);
  });
});
