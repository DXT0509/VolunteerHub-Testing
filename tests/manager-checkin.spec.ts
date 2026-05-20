import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const CHECKOUT_ROUTE = 'http://localhost:5173/check-out-volunteer';
const API_BASE = 'http://localhost:4000';

const managerUser = { id: 101, roles: [{ role: { name: 'EVENT_MANAGER' } }] };
const volunteerUser = { id: 202, roles: [{ role: { name: 'VOLUNTEER' } }] };

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

const seedAuth = async (page: Page, user = managerUser) => {
	const token = buildJwt({ exp: Math.floor(Date.now() / 1000) + 60 * 60, sub: user.id });
	await page.addInitScript(
		({ token, user }) => {
			localStorage.setItem('token', token);
			localStorage.setItem('user', JSON.stringify(user));
		},
		{ token, user }
	);
};

const buildEvent = (overrides: Partial<Record<string, unknown>> = {}) => ({
	id: 1,
	title: 'Campaign Alpha',
	name: 'Campaign Alpha',
	status: 'active',
	manager: { id: managerUser.id },
	manager_id: managerUser.id,
	creator_id: managerUser.id,
	start_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
	end_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
	category: { name: 'Environment' },
	location: {
		name: 'Community Hall',
		address_line: '12 Nguyen Trai',
		district: 'District 1',
		province: 'HCMC',
		country: 'VN',
	},
	description: 'Beach cleanup',
	capacity: 100,
	total_joined: 12,
	banner_url: 'https://example.com/banner.jpg',
	...overrides,
});

const buildUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
	id: 501,
	full_name: 'Alice Nguyen',
	username: 'alice',
	email: 'alice@example.com',
	phone: '0900000000',
	created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
	avatar_url: 'https://example.com/avatar.jpg',
	...overrides,
});

const buildRegistration = (overrides: Partial<Record<string, unknown>> = {}) => ({
	id: 11,
	user: buildUser(),
	event: buildEvent(),
	event_id: 1,
	...overrides,
});

const mockEvents = async (page: Page, getEvents: () => unknown[]) => {
	await page.route(`${API_BASE}/events/`, (route) => {
		if (route.request().method() !== 'GET') return route.continue();
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(getEvents()),
		});
	});
};

const mockApprovedRegistrations = async (page: Page, getRegs: () => unknown[]) => {
	await page.route(`${API_BASE}/registrations/approved`, (route) => {
		if (route.request().method() !== 'GET') return route.continue();
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(getRegs()),
		});
	});
};

const mockApprovedRegistrationsWithDelay = async (page: Page, getRegs: () => unknown[]) => {
	let release: () => void = () => {};
	const waitForRelease = new Promise<void>((resolve) => {
		release = resolve;
	});

	await page.route(`${API_BASE}/registrations/approved`, async (route) => {
		if (route.request().method() !== 'GET') return route.continue();
		await waitForRelease;
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(getRegs()),
		});
	});

	return { release };
};

const mockFinalizeRegistration = async (
	page: Page,
	options: { status: number; body?: Record<string, unknown> } = { status: 200, body: {} }
) => {
	await page.route('**/registrations/**/final', (route) => {
		if (route.request().method() !== 'PATCH') return route.continue();
		return route.fulfill({
			status: options.status,
			contentType: 'application/json',
			body: JSON.stringify(options.body ?? {}),
		});
	});
};

const baseEvents = [
	buildEvent(),
	buildEvent({ id: 2, title: 'Campaign Beta', name: 'Campaign Beta' }),
];

const setupManagerCheckOutPage = async (page: Page, user = managerUser) => {
	await seedAuth(page, user);
	await mockEvents(page, () => baseEvents);
};

test.describe('Manager - Check Out Volunteers', () => {
	test('renders heading, loading state, and table content', async ({ page }) => {
		await setupManagerCheckOutPage(page);
		const { release } = await mockApprovedRegistrationsWithDelay(page, () => [buildRegistration()]);

		await page.goto(CHECKOUT_ROUTE);

		await expect(page.getByRole('heading', { name: 'Update status after event' })).toBeVisible();
		await expect(page.getByText('Mark Completed or Absent for volunteers in ended events.')).toBeVisible();
		await expect(page.getByText('Loading...')).toBeVisible();

		release();

		await expect(page.getByText('Loading...')).toHaveCount(0);
		await expect(page.getByLabel('Filter by campaign')).toBeVisible();
		await expect(page.getByText('Total: 1 registrations')).toBeVisible();
		await expect(page.getByRole('columnheader', { name: 'Volunteer' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'alice' })).toBeVisible();
	});

	test('filters out future events and supports campaign filter', async ({ page }) => {
		await setupManagerCheckOutPage(page);
		const futureEvent = buildEvent({
			id: 3,
			title: 'Campaign Gamma',
			name: 'Campaign Gamma',
			end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		});
		const registrations = [
			buildRegistration({ id: 21, event: buildEvent({ id: 1, title: 'Campaign Alpha' }) }),
			buildRegistration({ id: 22, event: futureEvent, event_id: 3, user: buildUser({ id: 502, username: 'bob' }) }),
			buildRegistration({ id: 23, event: buildEvent({ id: 2, title: 'Campaign Beta' }), event_id: 2, user: buildUser({ id: 503, username: 'cindy' }) }),
		];

		await mockApprovedRegistrations(page, () => registrations);

		await page.goto(CHECKOUT_ROUTE);

		await expect(page.getByRole('cell', { name: 'alice' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'cindy' })).toBeVisible();
		await expect(page.getByText('Campaign Gamma')).toHaveCount(0);
		await expect(page.getByText('Total: 2 registrations')).toBeVisible();

		await page.getByLabel('Filter by campaign').click();
		await page.getByRole('option', { name: 'Campaign Beta' }).click();
		await expect(page.getByText('Total: 1 registrations')).toBeVisible();
		await expect(page.getByRole('cell', { name: 'cindy' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'alice' })).toHaveCount(0);
	});

	test('paginates registrations and exposes aria labels', async ({ page }) => {
		await setupManagerCheckOutPage(page);
		const registrations = Array.from({ length: 6 }, (_, index) =>
			buildRegistration({
				id: 100 + index,
				user: buildUser({ id: 700 + index, username: `volunteer${index + 1}` }),
			})
		);

		await mockApprovedRegistrations(page, () => registrations);

		await page.goto(CHECKOUT_ROUTE);

		await expect(page.getByText('Page 1 / 2')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Next page' })).toBeEnabled();

		await page.getByRole('button', { name: 'Next page' }).click();
		await expect(page.getByText('Page 2 / 2')).toBeVisible();
		await expect(page.getByRole('cell', { name: 'volunteer6' })).toBeVisible();
	});

	test('shows empty state when no ended registrations', async ({ page }) => {
		await setupManagerCheckOutPage(page);
		await mockApprovedRegistrations(page, () => []);

		await page.goto(CHECKOUT_ROUTE);

		await expect(page.getByText('No ended events or no volunteers to update.')).toBeVisible();
		await expect(page.getByText('Total: 0 registrations')).toBeVisible();
	});

	test('shows error state when fetch fails', async ({ page }) => {
		await setupManagerCheckOutPage(page);
		await page.route(`${API_BASE}/registrations/approved`, (route) =>
			route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({}) })
		);

		await page.goto(CHECKOUT_ROUTE);

		await expect(page.getByText('Failed to fetch volunteers')).toBeVisible();
	});

	test('opens event detail dialog and closes with Escape', async ({ page }) => {
		await setupManagerCheckOutPage(page);
		await mockApprovedRegistrations(page, () => [buildRegistration()]);

		await page.goto(CHECKOUT_ROUTE);
		await page.getByRole('button', { name: 'Event details' }).click();
		const dialog = page.getByRole('dialog', { name: 'Event details' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('Campaign Alpha')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.getByRole('heading', { name: 'Event details' })).toHaveCount(0);
	});

	test('opens volunteer detail dialog and closes with button', async ({ page }) => {
		await setupManagerCheckOutPage(page);
		await mockApprovedRegistrations(page, () => [buildRegistration()]);

		await page.goto(CHECKOUT_ROUTE);
		await page.getByRole('button', { name: 'Volunteer details' }).click();
		await expect(page.getByRole('heading', { name: 'Volunteer information' })).toBeVisible();
		await expect(page.getByText('Full name:')).toBeVisible();

		await page.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByRole('heading', { name: 'Volunteer information' })).toHaveCount(0);
	});

	test('marks a volunteer as completed and shows success toast', async ({ page }) => {
		await setupManagerCheckOutPage(page);
		await mockApprovedRegistrations(page, () => [buildRegistration({ id: 77 })]);
		await mockFinalizeRegistration(page, { status: 200, body: { success: true } });

		await page.goto(CHECKOUT_ROUTE);
		await page.getByRole('button', { name: 'Completed' }).click();

		await expect(page.getByRole('alert')).toContainText('Marked as Completed');
	});

	test('shows warning toast when marking absent fails', async ({ page }) => {
		await setupManagerCheckOutPage(page);
		await mockApprovedRegistrations(page, () => [buildRegistration({ id: 88 })]);
		await mockFinalizeRegistration(page, { status: 400, body: { error: 'Mark absent failed' } });

		await page.goto(CHECKOUT_ROUTE);
		await page.getByRole('button', { name: 'Absent' }).click();

		await expect(page.getByRole('alert')).toContainText('Mark absent failed');
	});

	test.describe('responsive sanity', () => {
		test.use({ viewport: { width: 390, height: 844 } });

		test('renders mobile table and view action', async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await setupManagerCheckOutPage(page);
			await mockApprovedRegistrations(page, () => [buildRegistration()]);

			await page.goto(CHECKOUT_ROUTE);

			await expect(page.getByRole('button', { name: 'View' })).toBeVisible();
		});
	});
});

test.describe('Manager - Check Out Volunteers navigation guards', () => {
	test('redirects to login when token is missing', async ({ page }) => {
		await page.goto(CHECKOUT_ROUTE);
		await page.waitForURL('**/login');
	});

	test('redirects to home when role is not manager', async ({ page }) => {
		await seedAuth(page, volunteerUser);
		await page.goto(CHECKOUT_ROUTE);
		await page.waitForURL((url) => url.pathname === '/');
	});
});
