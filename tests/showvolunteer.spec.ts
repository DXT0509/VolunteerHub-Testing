import { test, expect, Page } from '@playwright/test';

const SHOW_VOLUNTEERS_ROUTE = '/show-volunteers';
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
	end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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
	...overrides,
});

const buildRegistration = (overrides: Partial<Record<string, unknown>> = {}) => ({
	id: 11,
	created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
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

const mockKickVolunteer = async (
	page: Page,
	options: { status: number; body?: Record<string, unknown> } = { status: 200, body: {} }
) => {
	await page.route('**/registrations/**/status', (route) => {
		if (route.request().method() !== 'PATCH') return route.continue();
		return route.fulfill({
			status: options.status,
			contentType: 'application/json',
			body: JSON.stringify(options.body ?? {}),
		});
	});
};

test.describe('Manager - Show Volunteers', () => {
	const baseEvents = [
		buildEvent(),
		buildEvent({ id: 2, title: 'Campaign Beta', name: 'Campaign Beta' }),
	];

	test.beforeEach(async ({ page }) => {
		await seedAuth(page);
		await mockEvents(page, () => baseEvents);
	});

	test('renders heading, loading state, and table content', async ({ page }) => {
		const { release } = await mockApprovedRegistrationsWithDelay(page, () => [buildRegistration()]);

		await page.goto(SHOW_VOLUNTEERS_ROUTE);

		await expect(page.getByRole('heading', { name: 'Volunteers Currently Participating' })).toBeVisible();
		await expect(page.getByText('Manage volunteers who joined your campaigns: view details and kick if needed.')).toBeVisible();
		await expect(page.getByText('Loading...')).toBeVisible();

		release();

		await expect(page.getByText('Loading...')).toHaveCount(0);
		await expect(page.getByLabel('Filter by campaign')).toBeVisible();
		await expect(page.getByRole('columnheader', { name: 'Volunteer' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'alice' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Participating' })).toBeVisible();
	});

	test('supports campaign filter and total count', async ({ page }) => {
		const registrations = [
			buildRegistration({ id: 21, event: buildEvent({ id: 1, title: 'Campaign Alpha' }) }),
			buildRegistration({ id: 22, event: buildEvent({ id: 2, title: 'Campaign Beta' }), event_id: 2, user: buildUser({ id: 502, username: 'bob' }) }),
		];

		await mockApprovedRegistrations(page, () => registrations);

		await page.goto(SHOW_VOLUNTEERS_ROUTE);

		const total = page.getByText(/Total:/i).first();
		await expect(total).toContainText('2');
		await expect(page.getByRole('cell', { name: 'alice' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'bob' })).toBeVisible();

		await page.getByLabel('Filter by campaign').click();
		await page.getByRole('option', { name: 'Campaign Beta' }).click();
		await expect(page.getByRole('cell', { name: 'bob' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'alice' })).toHaveCount(0);
	});

	test('paginates registrations and exposes aria labels', async ({ page }) => {
		const registrations = Array.from({ length: 6 }, (_, index) =>
			buildRegistration({
				id: 100 + index,
				user: buildUser({ id: 700 + index, username: `user${index + 1}` }),
			})
		);

		await mockApprovedRegistrations(page, () => registrations);

		await page.goto(SHOW_VOLUNTEERS_ROUTE);

		await expect(page.getByText('Page 1 / 2')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Next page' })).toBeEnabled();

		await page.getByRole('button', { name: 'Next page' }).click();
		await expect(page.getByText('Page 2 / 2')).toBeVisible();
		await expect(page.getByRole('cell', { name: 'user6' })).toBeVisible();
	});

	test('shows empty state when no volunteers', async ({ page }) => {
		await mockApprovedRegistrations(page, () => []);

		await page.goto(SHOW_VOLUNTEERS_ROUTE);

		await expect(page.getByText('No volunteers are currently participating.')).toBeVisible();
	});

	test('shows error state when fetch fails', async ({ page }) => {
		await page.route(`${API_BASE}/registrations/approved`, (route) =>
			route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({}) })
		);

		await page.goto(SHOW_VOLUNTEERS_ROUTE);

		await expect(page.getByText('Failed to fetch volunteers list')).toBeVisible();
	});

	test('opens event detail dialog and closes with Escape', async ({ page }) => {
		await mockApprovedRegistrations(page, () => [buildRegistration()]);

		await page.goto(SHOW_VOLUNTEERS_ROUTE);
		await page.getByRole('button', { name: 'Event details' }).click();
		await expect(page.getByRole('heading', { name: 'Event Details' })).toBeVisible();
		await expect(page.getByText('Campaign Alpha')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.getByRole('heading', { name: 'Event Details' })).toHaveCount(0);
	});

	test('opens volunteer detail dialog and closes with button', async ({ page }) => {
		await mockApprovedRegistrations(page, () => [buildRegistration()]);

		await page.goto(SHOW_VOLUNTEERS_ROUTE);
		await page.getByRole('button', { name: 'Volunteer details' }).click();
		await expect(page.getByRole('heading', { name: 'Volunteer Information' })).toBeVisible();
		await expect(page.getByText('Full name:')).toBeVisible();

		await page.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByRole('heading', { name: 'Volunteer Information' })).toHaveCount(0);
	});

	test('opens kick confirm dialog and cancels', async ({ page }) => {
		await mockApprovedRegistrations(page, () => [buildRegistration()]);

		await page.goto(SHOW_VOLUNTEERS_ROUTE);
		await page.getByRole('button', { name: 'Kick' }).click();
		await expect(page.getByRole('heading', { name: 'Confirm kick' })).toBeVisible();

		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByRole('heading', { name: 'Confirm kick' })).toHaveCount(0);
	});

	test('kicks a volunteer and shows success toast', async ({ page }) => {
		await mockApprovedRegistrations(page, () => [buildRegistration({ id: 77 })]);
		await mockKickVolunteer(page, { status: 200, body: { success: true } });

		await page.goto(SHOW_VOLUNTEERS_ROUTE);
		await page.getByRole('button', { name: 'Kick' }).click();
		await page.getByRole('button', { name: 'Kick' }).click();

		await expect(page.getByRole('alert')).toContainText('Kicked volunteer from the event');
	});

	test('shows warning toast when kick fails', async ({ page }) => {
		await mockApprovedRegistrations(page, () => [buildRegistration({ id: 88 })]);
		await mockKickVolunteer(page, { status: 400, body: { error: 'Kick failed' } });

		await page.goto(SHOW_VOLUNTEERS_ROUTE);
		await page.getByRole('button', { name: 'Kick' }).click();
		await page.getByRole('button', { name: 'Kick' }).click();

		await expect(page.getByRole('alert')).toContainText('Kick failed');
	});

	test.describe('responsive sanity', () => {
		test.use({ viewport: { width: 390, height: 844 } });

		test('renders mobile table and view details action', async ({ page }) => {
			await mockApprovedRegistrations(page, () => [buildRegistration()]);

			await page.goto(SHOW_VOLUNTEERS_ROUTE);

			await expect(page.getByRole('button', { name: 'View Details' })).toBeVisible();
		});
	});
});

test.describe('Manager - Show Volunteers navigation guards', () => {
	test('redirects to login when token is missing', async ({ page }) => {
		await page.goto(SHOW_VOLUNTEERS_ROUTE);
		await page.waitForURL('**/login');
	});

	test('redirects to home when role is not manager', async ({ page }) => {
		await seedAuth(page, volunteerUser);
		await page.goto(SHOW_VOLUNTEERS_ROUTE);
		await page.waitForURL((url) => url.pathname === '/');
	});
});
