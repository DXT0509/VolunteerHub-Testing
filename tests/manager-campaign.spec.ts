import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const MANAGE_MY_CAMPAIGN_ROUTE = 'http://localhost:5173/manage-my-campaigns';
const managerUser = { id: 10, roles: [{ role: { name: 'EVENT_MANAGER' } }] };
const categories = [{ id: 1, name: 'Education' }];

const buildJwt = (payload: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const header = { alg: 'none', typ: 'JWT' };
  return `${encode(header)}.${encode(payload)}.`;
};

const buildEvent = (overrides: Partial<Record<string, unknown>> = {}) => {
  const now = Date.now();
  return {
    id: 1,
    title: 'Cleanup Drive',
    description: 'Help clean the park',
    category_id: 1,
    location_id: 1,
    location: {
      id: 1,
      name: 'District 1',
      address_line: '123 Street',
      district: '1',
      province: 'HCM',
      country: 'Viet Nam',
    },
    start_time: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
    approval_status: 'active',
    total_joined: 2,
    manager_id: managerUser.id,
    creator_id: managerUser.id,
    capacity: 10,
    banner_url: '',
    ...overrides,
  };
};

const mockCategories = async (page: Page) => {
  await page.route('**/categories', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(categories) });
  });
};

const mockEvents = async (page: Page, getEvents: () => unknown[]) => {
  await page.route('**/events/', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(getEvents()) });
  });
};

const setupManagerCampaignPage = async (page: Page) => {
  const token = buildJwt({ exp: 4102444800 });
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token, user: managerUser }
  );
  await mockCategories(page);
};

test.describe('Manager - Manage My Campaigns', () => {
  test('renders heading, subtitle, total, and table rows', async ({ page }) => {
    await setupManagerCampaignPage(page);
    const events = [buildEvent(), buildEvent({ id: 2, title: 'Food Drive' })];
    await mockEvents(page, () => events);

    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await expect(page.getByRole('heading', { name: 'My Campaigns' })).toBeVisible();
    await expect(page.getByText('Create and manage your campaigns: view details, edit, and delete as needed.')).toBeVisible();
    await expect(page.getByText('Total: 2 campaigns')).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Campaign' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Cleanup Drive/i })).toBeVisible();
    await expect(page.getByRole('row', { name: /Food Drive/i })).toBeVisible();
  });

  test('shows loading state before data resolves', async ({ page }) => {
    await setupManagerCampaignPage(page);
    let resolveList: () => void;
    const ready = new Promise<void>((resolve) => { resolveList = resolve; });
    await page.route('**/events/', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await ready;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([buildEvent()]) });
    });

    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await expect(page.getByText('Loading...')).toBeVisible();
    resolveList!();
    await expect(page.getByRole('row', { name: /Cleanup Drive/i })).toBeVisible();
  });

  test('shows empty state when no campaigns', async ({ page }) => {
    await setupManagerCampaignPage(page);
    await mockEvents(page, () => []);
    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await expect(page.locator('div.hidden.md\\:block table tbody td').filter({ hasText: 'No campaigns yet.' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Campaign' })).toBeVisible();
  });

  test('shows error state when fetch fails', async ({ page }) => {
    await setupManagerCampaignPage(page);
    await page.route('**/events/', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ status: 500, contentType: 'text/plain', body: 'Server error' });
    });

    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await expect(page.getByText('Could not fetch your campaigns')).toBeVisible();
  });

  test('filters campaigns by event status', async ({ page }) => {
    await setupManagerCampaignPage(page);
    const now = Date.now();
    const events = [
      buildEvent({ id: 1, title: 'Ended Event', start_time: new Date(now - 72 * 60 * 60 * 1000).toISOString(), end_time: new Date(now - 48 * 60 * 60 * 1000).toISOString() }),
      buildEvent({ id: 2, title: 'Ongoing Event', start_time: new Date(now - 2 * 60 * 60 * 1000).toISOString(), end_time: new Date(now + 2 * 60 * 60 * 1000).toISOString() }),
      buildEvent({ id: 3, title: 'Upcoming Event', start_time: new Date(now + 24 * 60 * 60 * 1000).toISOString(), end_time: new Date(now + 48 * 60 * 60 * 1000).toISOString() }),
    ];
    await mockEvents(page, () => events);

    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await page.getByLabel('Event status').click();
    await page.getByRole('option', { name: 'Upcoming' }).click();

    await expect(page.getByRole('row', { name: /Upcoming Event/i })).toBeVisible();
    await expect(page.getByRole('row', { name: /Ended Event/i })).toHaveCount(0);
  });

  test('paginates campaigns list', async ({ page }) => {
    await setupManagerCampaignPage(page);
    const events = Array.from({ length: 11 }, (_, i) => buildEvent({ id: i + 1, title: `Campaign ${i + 1}` }));
    await mockEvents(page, () => events);

    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await expect(page.getByText('Page 1 / 2')).toBeVisible();
    await expect(page.getByLabel('Previous page')).toBeDisabled();
    await page.getByLabel('Next page').click();
    await expect(page.getByText('Page 2 / 2')).toBeVisible();
  });

  test('opens and closes create dialog via Escape', async ({ page }) => {
    await setupManagerCampaignPage(page);
    await mockEvents(page, () => [buildEvent()]);
    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await page.getByRole('button', { name: 'Create New Campaign' }).click();
    await expect(page.getByRole('heading', { name: 'Create New Campaign' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Create New Campaign' })).toHaveCount(0);
  });

  test('validates required fields on create', async ({ page }) => {
    await setupManagerCampaignPage(page);
    await mockEvents(page, () => []);
    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await page.getByRole('button', { name: 'Create New Campaign' }).click();
    await expect(page.getByRole('heading', { name: 'Create New Campaign' })).toBeVisible();
    await page.getByRole('button', { name: 'Create' }).click();

    const createDialog = page.getByRole('dialog', { name: 'Create New Campaign' });
    await expect(createDialog.getByText('Please fill in all fields.')).toBeVisible();
  });

  test('creates a campaign successfully', async ({ page }) => {
    await setupManagerCampaignPage(page);
    const currentEvents = [buildEvent({ id: 1, title: 'Cleanup Drive' })];
    await mockEvents(page, () => currentEvents);
    await page.route('**/events', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const created = buildEvent({ id: 99, title: 'New Campaign' });
      currentEvents.push(created);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
    });

    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);
    await page.getByRole('button', { name: 'Create New Campaign' }).click();

    await page.getByLabel('Title').fill('New Campaign');
    await page.getByLabel('Category').click();
    await page.getByRole('option', { name: 'Education' }).click();
    await page.getByLabel('Start date').fill('2026-05-20T09:00');
    await page.getByLabel('End date').fill('2026-05-21T09:00');
    await page.getByLabel('Capacity').fill('12');
    await page.getByLabel('Location - Name').fill('Community Hall');
    await page.getByLabel('Location - Street number').fill('1 Main St');
    await page.getByLabel('District').fill('1');
    await page.getByLabel('Province').fill('HCM');
    await page.getByLabel('Country').fill('Viet Nam');
    await page.getByLabel('Description').fill('Campaign description');

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('alert')).toContainText('Event created successfully');
    await expect(page.getByRole('heading', { name: 'Create New Campaign' })).toHaveCount(0);
  });

  test('opens edit dialog and saves changes', async ({ page }) => {
    await setupManagerCampaignPage(page);
    const currentEvents = [buildEvent({ id: 1, title: 'Cleanup Drive', location_id: 1 })];
    await mockEvents(page, () => currentEvents);
    await page.route('**/events/*', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      const updated = { ...currentEvents[0], title: 'Cleanup Drive Updated' };
      currentEvents[0] = updated;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updated) });
    });

    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Campaign' })).toBeVisible();

    await page.getByLabel('Title').fill('Cleanup Drive Updated');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('alert')).toContainText('Campaign updated successfully');
  });

  test('deletes a campaign from the list', async ({ page }) => {
    await setupManagerCampaignPage(page);
    const currentEvents = [buildEvent({ id: 1, title: 'Cleanup Drive' })];
    await mockEvents(page, () => currentEvents);
    await page.route('**/events/*', async (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      currentEvents.splice(0, 1);
      return route.fulfill({ status: 204, contentType: 'application/json', body: '' });
    });

    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await page.getByRole('button', { name: 'Delete campaign' }).click();
    await expect(page.getByRole('heading', { name: 'Delete Campaign' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('alert')).toContainText('Campaign deleted successfully');
  });

  test('navigates to details view', async ({ page }) => {
    await setupManagerCampaignPage(page);
    await mockEvents(page, () => [buildEvent({ id: 5 })]);

    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);
    await page.getByRole('button', { name: 'View Details' }).click();

    await expect(page).toHaveURL(/\/events\/5/);
  });

  test('renders a usable mobile table', async ({ page }) => {
    await setupManagerCampaignPage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await mockEvents(page, () => [buildEvent({ id: 1 })]);

    await page.goto(MANAGE_MY_CAMPAIGN_ROUTE);

    await expect(page.getByRole('columnheader', { name: 'Campaign' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View' })).toBeVisible();
  });
});
