import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const MANAGE_MANAGER_CAMPAIGN_ROUTE = 'http://localhost:5173/manage-manager-campaigns';
const adminUser = { id: 1, roles: [{ role: { name: 'ADMIN' } }] };
const categories = [{ id: 1, name: 'Education' }];

const buildJwt = (payload: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
};

const buildEvent = (overrides: Partial<Record<string, unknown>> = {}) => {
  const now = Date.now();

  return {
    id: 1,
    title: 'Pending Campaign',
    description: 'Admin review campaign',
    category_id: 1,
    location_id: 1,
    location: {
      id: 1,
      name: 'Community Hall',
      address_line: '1 Main St',
      district: '1',
      province: 'HCM',
      country: 'Viet Nam',
    },
    start_time: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
    approval_status: 'pending',
    capacity: 20,
    banner_url: '',
    ...overrides,
  };
};

const setupAdminCampaignPage = async (page: Page, getEvents: () => unknown[]) => {
  const token = buildJwt({ exp: 4102444800 });

  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token, user: adminUser },
  );

  await page.route('**/categories', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(categories),
    });
  });

  await page.route('**/events/', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(getEvents()),
    });
  });
};

test.describe('Admin Event Management - Manage manager campaigns', () => {
  test('approves a pending campaign', async ({ page }) => {
    const currentEvents = [
      buildEvent({ id: 1, title: 'Pending Campaign', approval_status: 'pending' }),
      buildEvent({ id: 2, title: 'Approved Campaign', approval_status: 'active' }),
    ];

    await setupAdminCampaignPage(page, () => currentEvents);
    await page.route('**/admin/*/approve', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const target = currentEvents.find((event) => event.id === 1);
      if (target) target.approval_status = 'active';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(target),
      });
    });

    await page.goto(MANAGE_MANAGER_CAMPAIGN_ROUTE);

    await expect(page.getByRole('heading', { name: 'Event Management' })).toBeVisible();
    await expect(page.getByLabel('Search events')).toBeVisible();

    const pendingRow = page.getByRole('row', { name: /Pending Campaign/i });
    await expect(pendingRow).toContainText('Pending');

    await pendingRow.getByRole('button', { name: /Approve/i }).click();

    await expect(page.getByRole('alert')).toContainText('Approved event');
    await expect(pendingRow).toContainText('Approved');
    await expect(pendingRow.getByRole('button', { name: /Delete/i })).toBeVisible();
  });

  test('deletes a rejected campaign', async ({ page }) => {
    const currentEvents = [
      buildEvent({ id: 1, title: 'Rejected Campaign', approval_status: 'rejected' }),
      buildEvent({ id: 2, title: 'Pending Campaign', approval_status: 'pending' }),
    ];

    await setupAdminCampaignPage(page, () => currentEvents);
    await page.route('**/events/*', async (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      const index = currentEvents.findIndex((event) => event.id === 1);
      if (index !== -1) currentEvents.splice(index, 1);
      return route.fulfill({ status: 204, contentType: 'application/json', body: '' });
    });

    await page.goto(MANAGE_MANAGER_CAMPAIGN_ROUTE);

    const rejectedRow = page.getByRole('row', { name: /Rejected Campaign/i });
    await expect(rejectedRow).toContainText('Rejected');

    await rejectedRow.getByRole('button', { name: /Delete/i }).click();
    await expect(page.getByRole('heading', { name: 'Delete event' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('alert')).toContainText('Deleted event');
    await expect(page.getByRole('row', { name: /Rejected Campaign/i })).toHaveCount(0);
  });
});
