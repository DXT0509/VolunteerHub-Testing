import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const USER_PROFILE_ROUTE = 'http://localhost:5173/user-profile';

const buildJwt = (payload: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
};

const buildVolunteer = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 2,
  username: 'volunteer1',
  full_name: 'Volunteer One',
  email: 'volunteer1@gmail.com',
  phone: '0980000001',
  avatar_url: '',
  is_active: true,
  created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  roles: [{ role: { name: 'VOLUNTEER' } }],
  ...overrides,
});

const setupProfilePage = async (page: Page, getUser: () => ReturnType<typeof buildVolunteer>) => {
  const token = buildJwt({ exp: 4102444800 });

  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token, user: getUser() },
  );

  await page.route('**/users/me', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(getUser()),
      });
    }

    if (route.request().method() === 'PUT') {
      const form = route.request().postDataBuffer();
      const body = form?.toString('utf8') ?? '';
      const fullName = body.match(/name="full_name"\r?\n\r?\n([^\r\n]+)/)?.[1] ?? getUser().full_name;
      const phone = body.match(/name="phone"\r?\n\r?\n([^\r\n]+)/)?.[1] ?? getUser().phone;
      const username = body.match(/name="username"\r?\n\r?\n([^\r\n]+)/)?.[1] ?? getUser().username;
      const updated = { ...getUser(), full_name: fullName, phone, username };

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated),
      });
    }

    return route.continue();
  });
};

const profileInputByLabel = (page: Page, label: RegExp) =>
  page
    .locator('div.flex')
    .filter({ has: page.locator('span').filter({ hasText: label }) })
    .locator('input');

test.describe('User Profile - view and update profile', () => {
  test('shows profile data and updates personal information', async ({ page }) => {
    let currentUser = buildVolunteer();
    await setupProfilePage(page, () => currentUser);

    await page.route('**/users/me', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentUser) });
      }

      if (route.request().method() === 'PUT') {
        const body = route.request().postDataBuffer()?.toString('utf8') ?? '';
        currentUser = buildVolunteer({
          full_name: body.match(/name="full_name"\r?\n\r?\n([^\r\n]+)/)?.[1] ?? currentUser.full_name,
          phone: body.match(/name="phone"\r?\n\r?\n([^\r\n]+)/)?.[1] ?? currentUser.phone,
          username: body.match(/name="username"\r?\n\r?\n([^\r\n]+)/)?.[1] ?? currentUser.username,
        });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentUser) });
      }

      return route.continue();
    });

    await page.goto(USER_PROFILE_ROUTE);

    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

    const fullNameInput = profileInputByLabel(page, /Full name/i);
    const emailInput = profileInputByLabel(page, /Email/i);
    const phoneInput = profileInputByLabel(page, /Phone/i);
    const usernameInput = profileInputByLabel(page, /Username/i);

    await expect(fullNameInput).toHaveValue('Volunteer One');
    await expect(emailInput).toHaveValue('volunteer1@gmail.com');
    await expect(emailInput).toBeDisabled();

    await fullNameInput.fill('Volunteer One Updated');
    await phoneInput.fill('0981111222');
    await usernameInput.fill('volunteer-one');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible({ timeout: 15000 });
    await expect(profileInputByLabel(page, /Full name/i)).toHaveValue('Volunteer One Updated');
    await expect(profileInputByLabel(page, /Phone/i)).toHaveValue('0981111222');
    await expect(profileInputByLabel(page, /Username/i)).toHaveValue('volunteer-one');
  });
});
