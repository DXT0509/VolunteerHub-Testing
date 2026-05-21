import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const CONTROL_USERS_ROUTE = 'http://localhost:5173/control-users';
const adminUser = { id: 1, roles: [{ role: { name: 'ADMIN' } }] };

const buildJwt = (payload: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
};

const buildUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 22,
  username: 'volunteer22',
  full_name: 'Volunteer 22',
  email: 'volunteer22@gmail.com',
  phone: '0980000022',
  is_active: true,
  created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  roles: [{ role: { name: 'VOLUNTEER' } }],
  ...overrides,
});

const setupAdminUsersPage = async (page: Page, getUsers: () => unknown[]) => {
  const token = buildJwt({ exp: 4102444800 });

  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token, user: adminUser },
  );

  await page.route('**/admin', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(getUsers()),
    });
  });
};

test.describe('Admin User Control - Lock and unlock users', () => {
  test('locks and unlocks the volunteer22 account', async ({ page }) => {
    const currentUsers = [
      buildUser(),
      buildUser({ id: 30, username: 'manager30', full_name: 'Manager 30', email: 'manager30@gmail.com', roles: [{ role: { name: 'EVENT_MANAGER' } }] }),
    ];

    await setupAdminUsersPage(page, () => currentUsers);
    await page.route('**/admin/*/status', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();

      const url = route.request().url();
      const id = Number(url.match(/\/admin\/(\d+)\/status/)?.[1]);
      const body = route.request().postDataJSON() as { is_active: boolean };
      const target = currentUsers.find((user) => user.id === id);
      if (target) target.is_active = body.is_active;

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(target),
      });
    });

    await page.goto(CONTROL_USERS_ROUTE);

    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    const searchInput = page.getByLabel('Search users');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Volunteer 22');
    await searchInput.press('Enter');

    const volunteerRow = page.getByRole('row', { name: /volunteer22@gmail\.com/i });
    await expect(volunteerRow).toContainText('Active');

    await volunteerRow.getByRole('button', { name: /Lock/i }).click();
    await expect(page.getByRole('alert')).toContainText('Locked account');
    await expect(volunteerRow).toContainText('Locked');

    await volunteerRow.getByRole('button', { name: /Unlock/i }).click();
    await expect(page.getByRole('alert')).toContainText('Unlocked account');
    await expect(volunteerRow).toContainText('Active');
  });
});
