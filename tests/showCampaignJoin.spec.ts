import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const BASE = 'http://localhost:5173';

function createValidJwtToken(expOffsetSeconds = 3600) {
	const encodeBase64Url = (value: string) => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
	const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = encodeBase64Url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }));
	return `${header}.${payload}.signature`;
}

async function setAuthState(page: Page, userValue: unknown, token = createValidJwtToken()) {
	await page.addInitScript(({ tokenValue, userJson }) => {
		if (localStorage.getItem('__auth_seeded__')) {
			return;
		}
		localStorage.setItem('token', tokenValue);
		localStorage.setItem('user', userJson);
		localStorage.setItem('__auth_seeded__', '1');
	}, {
		tokenValue: token,
		userJson: typeof userValue === 'string' ? userValue : JSON.stringify(userValue),
	});
}

async function clearAuthState(page: Page) {
	await page.addInitScript(() => {
		localStorage.removeItem('token');
		localStorage.removeItem('user');
		localStorage.removeItem('__auth_seeded__');
	});
}

async function mockRegistrations(page: Page, registrations: any[], status = 200) {
	await page.route('http://localhost:4000/registrations/my', (route) => {
		route.fulfill({
			status,
			contentType: 'application/json',
			body: JSON.stringify(registrations),
		});
	});
}

async function mockRegistrationsNetworkError(page: Page) {
	await page.route('http://localhost:4000/registrations/my', (route) => {
		route.abort('failed');
	});
}

async function mockRegistrationsDelayed(page: Page, registrations: any[], status = 200) {
	let release: (() => void) | undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});

	await page.route('http://localhost:4000/registrations/my', async (route) => {
		await gate;
		await route.fulfill({
			status,
			contentType: 'application/json',
			body: JSON.stringify(registrations),
		});
	});

	return () => release?.();
}

async function selectStatusFilter(page: Page, label: string) {
	const filter = page.getByRole('combobox', { name: 'Filter by status' });
	await filter.click();
	await page.getByRole('option', { name: label }).click();
	await expect(filter).toHaveText(label);
}

function makeRegistration(overrides: Partial<any> = {}) {
	return {
		id: 11,
		event_id: 101,
		status: 'approved',
		event: {
			id: 101,
			title: 'Community Cleanup Day',
			name: 'Community Cleanup Day',
			start_time: '2026-06-01T09:00:00.000Z',
			location: { name: 'District 1' },
		},
		...overrides,
	};
}

function makeRegistrations(count: number, overrides: (index: number) => Partial<any> = () => ({})) {
	return Array.from({ length: count }, (_, index) =>
		makeRegistration({
			id: 1000 + index,
			event_id: 2000 + index,
			status: 'approved',
			event: {
				id: 2000 + index,
				title: `Bulk Campaign ${index + 1}`,
				name: `Bulk Campaign ${index + 1}`,
				start_time: '2026-12-01T09:00:00.000Z',
				location: { name: `District ${index + 1}` },
			},
			...overrides(index),
		}),
	);
}

async function mockRegistrationsSequence(page: Page, responses: Array<{ registrations: any[]; status?: number }>) {
	let index = 0;
	await page.route('http://localhost:4000/registrations/my', (route) => {
		const response = responses[Math.min(index, responses.length - 1)];
		index += 1;
		route.fulfill({
			status: response.status ?? 200,
			contentType: 'application/json',
			body: JSON.stringify(response.registrations),
		});
	});
}

async function mockDashboard(page: Page) {
	await page.route('http://localhost:4000/dashboard', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ hot_events: [] }),
		}),
	);
}

function desktopRows(page: Page) {
	return page.locator('div.hidden.md\\:block table tbody tr');
}

function desktopCell(page: Page, name: string | RegExp) {
	return page.locator('div.hidden.md\\:block table').getByRole('cell', { name, exact: typeof name === 'string' });
}

async function loginAsVolunteer(page: Page, overrides: Partial<any> = {}) {
	await setAuthState(page, {
		id: 70,
		full_name: 'Spec Volunteer',
		email: 'spec-volunteer@example.com',
		phone: '0912345678',
		roles: [{ role: { name: 'VOLUNTEER' } }],
		...overrides,
	});
}

async function clickCancelRegistration(page: Page, rowText: string) {
	const row = page.locator('tr', { hasText: rowText }).first();
	await row.getByRole('button', { name: /Cancel registration|Hủy đăng ký/i }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
}

async function expectPageIndicator(page: Page, current: number, total: number) {
	await expect(page.getByText(new RegExp(`(Trang|Page)\\s+${current}\\s*\\/\\s*${total}`, 'i'))).toBeVisible();
}


test.describe('ShowCampaignJoin UI rendering', () => {
	test('shows title, subtitle, loading state, desktop table, and status text', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page, {
			id: 7,
			full_name: 'Valid Volunteer',
			email: 'valid@example.com',
			phone: '0901234567',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});
		const release = await mockRegistrationsDelayed(page, [
			makeRegistration({ status: 'approved' }),
			makeRegistration({ id: 12, event_id: 102, status: 'pending', event: { id: 102, title: 'Food Drive', name: 'Food Drive', start_time: '2026-06-02T10:00:00.000Z', location: { name: 'District 2' } } }),
			makeRegistration({ id: 13, event_id: 103, status: 'rejected', event: { id: 103, title: 'Tree Planting', name: 'Tree Planting', start_time: '2026-06-03T11:00:00.000Z', location: { name: 'District 3' } } }),
			makeRegistration({ id: 14, event_id: 104, status: 'completed', event: { id: 104, title: 'Beach Cleanup', name: 'Beach Cleanup', start_time: '2026-06-04T12:00:00.000Z', location: { name: 'District 4' } } }),
			makeRegistration({ id: 15, event_id: 105, status: 'Absent', event: { id: 105, title: 'Community Visit', name: 'Community Visit', start_time: '2026-06-05T13:00:00.000Z', location: { name: 'District 5' } } }),
			makeRegistration({ id: 16, event_id: 106, status: 'cancelled', event: { id: 106, title: 'Cancelled Campaign', name: 'Cancelled Campaign', start_time: '2026-06-06T14:00:00.000Z', location: { name: 'District 6' } } }),
		]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'domcontentloaded' });

		await expect(page.getByRole('heading', { name: /Campaigns you registered/i })).toBeVisible();
		await expect(page.getByText(/Your registered campaigns appear here\./i)).toBeVisible();
		await expect(page.getByText('Loading...')).toBeVisible();
		await expect(page.getByRole('progressbar')).toBeVisible();

		release();
		await expect(page.getByLabel('Filter by status')).toBeVisible();
		await expect(page.getByText(/Total:\s*5\s+campaigns/i)).toBeVisible();

		const desktopTable = page.locator('div.hidden.md\\:block table');
		await expect(desktopTable).toBeVisible();
		await expect(desktopTable.locator('th')).toHaveText(['#', 'Event', 'Status', 'Time', 'Location', 'Actions']);
		const approvedRow = page.locator('tr', { hasText: 'Community Cleanup Day' }).first();
		const pendingRow = page.locator('tr', { hasText: 'Food Drive' }).first();
		const rejectedRow = page.locator('tr', { hasText: 'Tree Planting' }).first();
		const completedRow = page.locator('tr', { hasText: 'Beach Cleanup' }).first();
		const absentRow = page.locator('tr', { hasText: 'Community Visit' }).first();
		await expect(approvedRow).toBeVisible();
		await expect(approvedRow).toContainText('Joined');
		await expect(pendingRow).toContainText('Pending');
		await expect(rejectedRow).toContainText('Rejected');
		await expect(completedRow).toContainText('Completed');
		await expect(absentRow).toContainText('Absent');
		await expect(page.getByRole('button', { name: /View details/i })).toHaveCount(5);
		await expect(approvedRow.getByRole('button', { name: /View details/i })).toBeVisible();
	});

	test('shows empty state and keeps filter UI visible when there are no registrations', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page, {
			id: 8,
			full_name: 'Empty Volunteer',
			email: 'empty@example.com',
			phone: '0901111111',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});
		await mockRegistrations(page, []);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await expect(page.getByRole('heading', { name: /Campaigns you registered/i })).toBeVisible();
		await expect(page.getByLabel('Filter by status')).toBeVisible();
		await expect(page.getByText(/Total:\s*0\s+campaigns/i)).toBeVisible();
		await expect(page.locator('div.hidden.md\\:block table').getByRole('cell', { name: 'No events yet.' })).toBeVisible();
		await expect(page.locator('div.md\\:hidden table')).toBeHidden();
	});

	test('renders long event and location values without breaking and leaves missing time blank', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page, {
			id: 11,
			full_name: 'Long Text Volunteer',
			email: 'long@example.com',
			phone: '0902222222',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});
		await mockRegistrations(page, [
			makeRegistration({
				id: 21,
				event_id: 201,
				status: 'approved',
				event: {
					id: 201,
					title: 'Community Cleanup Day with a Very Long Title That Should Still Render Correctly In The Table',
					name: 'Community Cleanup Day with a Very Long Title That Should Still Render Correctly In The Table',
					start_time: null,
					location: { name: 'A very long location name that should stay visible without breaking the layout' },
				},
			}),
		]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		const row = page.locator('tr', { hasText: 'Community Cleanup Day with a Very Long Title' }).first();
		await expect(row).toBeVisible();
		await expect(row).toContainText('Joined');
		await expect(row.locator('td').nth(3)).toBeEmpty();
		await expect(row).toContainText('A very long location name that should stay visible without breaking the layout');
		await expect(row.getByRole('button', { name: 'View details' })).toBeVisible();
	});

	test('shows cancel registration only when the row is eligible', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page, {
			id: 12,
			full_name: 'Cancel Volunteer',
			email: 'cancel@example.com',
			phone: '0903333333',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});
		await mockRegistrations(page, [
			makeRegistration({
				id: 31,
				event_id: 301,
				status: 'approved',
				event: { id: 301, title: 'Approved Future Campaign', name: 'Approved Future Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District 1' } },
			}),
			makeRegistration({
				id: 32,
				event_id: 302,
				status: 'rejected',
				event: { id: 302, title: 'Rejected Future Campaign', name: 'Rejected Future Campaign', start_time: '2026-12-02T09:00:00.000Z', location: { name: 'District 2' } },
			}),
		]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		const approvedRow = page.locator('tr', { hasText: 'Approved Future Campaign' }).first();
		const rejectedRow = page.locator('tr', { hasText: 'Rejected Future Campaign' }).first();
		await expect(approvedRow.getByRole('button', { name: 'Cancel registration' })).toBeVisible();
		await expect(rejectedRow.getByRole('button', { name: 'Cancel registration' })).toHaveCount(0);
	});
});

test.describe('ShowCampaignJoin data list', () => {
	test('renders a full list from API and excludes cancelled registrations', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page, {
			id: 21,
			full_name: 'List Volunteer',
			email: 'list@example.com',
			phone: '0904444444',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});
		await mockRegistrations(page, [
			makeRegistration({ id: 41, event_id: 401, status: 'approved', event: { id: 401, title: 'Cleanup Alpha', name: 'Cleanup Alpha', start_time: '2026-06-07T09:00:00.000Z', location: { name: 'District A' } } }),
			makeRegistration({ id: 42, event_id: 402, status: 'pending', event: { id: 402, title: 'Food Drive Beta', name: 'Food Drive Beta', start_time: '2026-06-08T10:00:00.000Z', location: { name: 'District B' } } }),
			makeRegistration({ id: 43, event_id: 403, status: 'rejected', event: { id: 403, title: 'Tree Planting Gamma', name: 'Tree Planting Gamma', start_time: '2026-06-09T11:00:00.000Z', location: { name: 'District C' } } }),
			makeRegistration({ id: 44, event_id: 404, status: 'completed', event: { id: 404, title: 'Beach Cleanup Delta', name: 'Beach Cleanup Delta', start_time: '2026-06-10T12:00:00.000Z', location: { name: 'District D' } } }),
			makeRegistration({ id: 45, event_id: 405, status: 'cancelled', event: { id: 405, title: 'Cancelled Campaign', name: 'Cancelled Campaign', start_time: '2026-06-11T13:00:00.000Z', location: { name: 'District E' } } }),
		]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		const desktopTable = page.locator('div.hidden.md\\:block table');
		await expect(desktopTable).toBeVisible();
		await expect(page.getByText(/Total:\s*4\s+campaigns/i)).toBeVisible();
		await expect(desktopTable.locator('tbody tr')).toHaveCount(4);
		await expect(desktopTable.locator('tbody tr').filter({ hasText: 'Cleanup Alpha' })).toContainText('Joined');
		await expect(desktopTable.locator('tbody tr').filter({ hasText: 'Food Drive Beta' })).toContainText('Pending');
		await expect(desktopTable.locator('tbody tr').filter({ hasText: 'Tree Planting Gamma' })).toContainText('Rejected');
		await expect(desktopTable.locator('tbody tr').filter({ hasText: 'Beach Cleanup Delta' })).toContainText('Completed');
		await expect(desktopTable.getByText('Cancelled Campaign')).toHaveCount(0);
		await expect(page.getByRole('button', { name: /View details/i })).toHaveCount(4);
	});

	test('shows empty state when API returns no registrations', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page, {
			id: 22,
			full_name: 'Empty List Volunteer',
			email: 'empty-list@example.com',
			phone: '0905555555',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});
		await mockRegistrations(page, []);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		const desktopTable = page.locator('div.hidden.md\\:block table');
		const mobileTable = page.locator('div.md\\:hidden table');
		await expect(page.getByText(/Total:\s*0\s+campaigns/i)).toBeVisible();
		await expect(desktopTable.getByRole('cell', { name: /No events yet\./i })).toBeVisible();
		await expect(mobileTable.getByRole('cell', { name: /No events yet\./i })).toBeHidden();
	});

	test('shows an error state when the API returns 500', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page, {
			id: 23,
			full_name: 'Error Volunteer',
			email: 'error@example.com',
			phone: '0906666666',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});
		await mockRegistrations(page, [], 500);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'domcontentloaded' });

		await expect(page.getByText(/Can't take event registration|Failed to fetch your registrations|Không lấy được danh sách tham gia/i)).toBeVisible();
		await expect(page.getByRole('heading', { name: /Campaigns you registered/i })).toBeVisible();
	});

	test('shows an error state when the network request fails', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page, {
			id: 24,
			full_name: 'Network Error Volunteer',
			email: 'network@example.com',
			phone: '0907777777',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});
		await mockRegistrationsNetworkError(page);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'domcontentloaded' });

		await expect(page.getByText(/Không lấy được danh sách tham gia|Failed to fetch|net::ERR_FAILED/i)).toBeVisible();
		await expect(page.getByRole('heading', { name: /Campaigns you registered/i })).toBeVisible();
	});
});

test.describe('ShowCampaignJoin status filter', () => {
	const statusFilterRegistrations = [
		makeRegistration({ id: 91, event_id: 901, status: 'pending', event: { id: 901, title: 'Filter Pending Campaign', name: 'Filter Pending Campaign', start_time: '2026-07-01T09:00:00.000Z', location: { name: 'District Filter' } } }),
		makeRegistration({ id: 92, event_id: 902, status: 'approved', event: { id: 902, title: 'Filter Approved Campaign', name: 'Filter Approved Campaign', start_time: '2026-07-02T09:00:00.000Z', location: { name: 'District Filter' } } }),
		makeRegistration({ id: 93, event_id: 903, status: 'completed', event: { id: 903, title: 'Filter Completed Campaign', name: 'Filter Completed Campaign', start_time: '2026-07-03T09:00:00.000Z', location: { name: 'District Filter' } } }),
		makeRegistration({ id: 94, event_id: 904, status: 'Absent', event: { id: 904, title: 'Filter Absent Campaign', name: 'Filter Absent Campaign', start_time: '2026-07-04T09:00:00.000Z', location: { name: 'District Filter' } } }),
		makeRegistration({ id: 95, event_id: 905, status: 'rejected', event: { id: 905, title: 'Filter Rejected Campaign', name: 'Filter Rejected Campaign', start_time: '2026-07-05T09:00:00.000Z', location: { name: 'District Filter' } } }),
		makeRegistration({ id: 96, event_id: 906, status: 'cancelled', event: { id: 906, title: 'Filter Cancelled Campaign', name: 'Filter Cancelled Campaign', start_time: '2026-07-06T09:00:00.000Z', location: { name: 'District Filter' } } }),
	];

	async function openStatusFilterPage(page: Page) {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'status-filter@example.com' });
		await mockRegistrations(page, statusFilterRegistrations);
		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
	}

	async function expectOnlyCampaigns(page: Page, visibleTitles: string[]) {
		const allTitles = [
			'Filter Pending Campaign',
			'Filter Approved Campaign',
			'Filter Completed Campaign',
			'Filter Absent Campaign',
			'Filter Rejected Campaign',
		];
		await expect(desktopRows(page)).toHaveCount(visibleTitles.length);
		for (const title of allTitles) {
			if (visibleTitles.includes(title)) {
				await expect(desktopCell(page, title)).toBeVisible();
			} else {
				await expect(desktopCell(page, title)).toHaveCount(0);
			}
		}
		await expect(desktopCell(page, 'Filter Cancelled Campaign')).toHaveCount(0);
	}

	test('selecting all shows every valid registration and excludes cancelled ones', async ({ page }) => {
		await openStatusFilterPage(page);

		await selectStatusFilter(page, 'All');

		await expectOnlyCampaigns(page, [
			'Filter Pending Campaign',
			'Filter Approved Campaign',
			'Filter Completed Campaign',
			'Filter Absent Campaign',
			'Filter Rejected Campaign',
		]);
		await expect(page.getByText(/Total:\s*5\s+campaigns/i)).toBeVisible();
	});

	test('filters pending registrations only', async ({ page }) => {
		await openStatusFilterPage(page);

		await selectStatusFilter(page, 'Pending');

		await expectOnlyCampaigns(page, ['Filter Pending Campaign']);
		await expect(desktopRows(page).first()).toContainText('Pending');
	});

	test('filters approved registrations only', async ({ page }) => {
		await openStatusFilterPage(page);

		await selectStatusFilter(page, 'Joined');

		await expectOnlyCampaigns(page, ['Filter Approved Campaign']);
		await expect(desktopRows(page).first()).toContainText('Joined');
	});

	test('filters completed registrations only', async ({ page }) => {
		await openStatusFilterPage(page);

		await selectStatusFilter(page, 'Completed');

		await expectOnlyCampaigns(page, ['Filter Completed Campaign']);
		await expect(desktopRows(page).first()).toContainText('Completed');
	});

	test('filters absent registrations only', async ({ page }) => {
		await openStatusFilterPage(page);

		await selectStatusFilter(page, 'Absent');

		await expectOnlyCampaigns(page, ['Filter Absent Campaign']);
		await expect(desktopRows(page).first()).toContainText('Absent');
	});

	test('filters rejected registrations only', async ({ page }) => {
		await openStatusFilterPage(page);

		await selectStatusFilter(page, 'Rejected');

		await expectOnlyCampaigns(page, ['Filter Rejected Campaign']);
		await expect(desktopRows(page).first()).toContainText('Rejected');
	});

	test('switching filters back and forth does not lose the original data set', async ({ page }) => {
		await openStatusFilterPage(page);

		await selectStatusFilter(page, 'Pending');
		await expectOnlyCampaigns(page, ['Filter Pending Campaign']);

		await selectStatusFilter(page, 'Rejected');
		await expectOnlyCampaigns(page, ['Filter Rejected Campaign']);

		await selectStatusFilter(page, 'All');
		await expectOnlyCampaigns(page, [
			'Filter Pending Campaign',
			'Filter Approved Campaign',
			'Filter Completed Campaign',
			'Filter Absent Campaign',
			'Filter Rejected Campaign',
		]);
	});

	test('status select label and rendered values match the visible language', async ({ page }) => {
		await openStatusFilterPage(page);

		const filter = page.getByRole('combobox', { name: 'Filter by status' });
		await expect(filter).toBeVisible();
		await expect(filter).toHaveText('All');

		await selectStatusFilter(page, 'Pending');
		await expect(filter).toHaveText('Pending');

		await selectStatusFilter(page, 'Joined');
		await expect(filter).toHaveText('Joined');

		await selectStatusFilter(page, 'Completed');
		await expect(filter).toHaveText('Completed');

		await selectStatusFilter(page, 'Absent');
		await expect(filter).toHaveText('Absent');

		await selectStatusFilter(page, 'Rejected');
		await expect(filter).toHaveText('Rejected');
	});

	test('shows empty state for a status with no matching campaigns', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page, {
			id: 31,
			full_name: 'Empty Filter Volunteer',
			email: 'empty-filter@example.com',
			phone: '0909999999',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});
		await mockRegistrations(page, [
			makeRegistration({ id: 61, event_id: 601, status: 'approved', event: { id: 601, title: 'Approved Filtered Campaign', name: 'Approved Filtered Campaign', start_time: '2026-06-13T09:00:00.000Z', location: { name: 'District A' } } }),
		]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await selectStatusFilter(page, 'Pending');
		await expect(page.locator('div.hidden.md\\:block table').getByRole('cell', { name: 'No events that you Pending' })).toBeVisible();
		await expect(page.getByText(/Total:\s*0\s+campaigns/i)).toBeVisible();
	});

	

	test('resets to page one when the filter changes', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page, {
			id: 33,
			full_name: 'Pagination Volunteer',
			email: 'pagination@example.com',
			phone: '0911111111',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});

		const registrations = Array.from({ length: 12 }, (_, index) =>
			makeRegistration({
				id: 70 + index,
				event_id: 700 + index,
				status: index < 10 ? 'approved' : 'pending',
				event: {
					id: 700 + index,
					title: index < 10 ? `Approved Bulk ${index + 1}` : `Pending Bulk ${index + 1}`,
					name: index < 10 ? `Approved Bulk ${index + 1}` : `Pending Bulk ${index + 1}`,
					start_time: '2026-06-14T09:00:00.000Z',
					location: { name: 'District Bulk' },
				},
			}),
		);
		await mockRegistrations(page, registrations);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await expect(page.getByText(/Trang 1\s*\/\s*2|Page 1\s*\/\s*2/i)).toBeVisible();
		await page.getByRole('button', { name: /Trang sau|Next page/i }).click();
		await expect(page.getByText(/Trang 2\s*\/\s*2|Page 2\s*\/\s*2/i)).toBeVisible();

		await selectStatusFilter(page, 'Pending');
		await expect(page.getByText(/Trang 1\s*\/\s*1|Page 1\s*\/\s*1/i)).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Pending Bulk 11' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Pending Bulk 12' })).toBeVisible();
	});
});

test.describe('ShowCampaignJoin pagination', () => {
	test('shows only 10 rows per page when the list is longer than 10 items', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'page-size@example.com' });
		await mockRegistrations(page, makeRegistrations(12));

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await expect(desktopRows(page)).toHaveCount(10);
		await expect(desktopCell(page, 'Bulk Campaign 1')).toBeVisible();
		await expect(desktopCell(page, 'Bulk Campaign 10')).toBeVisible();
		await expect(desktopCell(page, 'Bulk Campaign 11')).toHaveCount(0);
		await expectPageIndicator(page, 1, 2);
	});

	test('disables previous page on the first page and next page on the last page', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'page-buttons@example.com' });
		await mockRegistrations(page, makeRegistrations(11));

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		const previous = page.getByRole('button', { name: /Trang trước|Previous page/i });
		const next = page.getByRole('button', { name: /Trang sau|Next page/i });
		await expect(previous).toBeDisabled();
		await expect(next).toBeEnabled();

		await next.click();
		await expectPageIndicator(page, 2, 2);
		await expect(previous).toBeEnabled();
		await expect(next).toBeDisabled();
	});

	test('navigating back and forth keeps row numbers aligned with the page', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'page-row-number@example.com' });
		await mockRegistrations(page, makeRegistrations(12));

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await expect(desktopRows(page).first().locator('td').first()).toHaveText('1');
		await page.getByRole('button', { name: /Trang sau|Next page/i }).click();
		await expect(desktopRows(page).first().locator('td').first()).toHaveText('11');
		await expect(desktopCell(page, 'Bulk Campaign 11')).toBeVisible();

		await page.getByRole('button', { name: /Trang trước|Previous page/i }).click();
		await expect(desktopRows(page).first().locator('td').first()).toHaveText('1');
		await expect(desktopCell(page, 'Bulk Campaign 1')).toBeVisible();
	});

	test('keeps pagination valid when filtering reduces results below page size', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'page-filter@example.com' });
		await mockRegistrations(page, makeRegistrations(12, (index) => ({
			status: index < 10 ? 'approved' : 'pending',
			event: {
				id: 2100 + index,
				title: index < 10 ? `Approved Page ${index + 1}` : `Pending Page ${index + 1}`,
				name: index < 10 ? `Approved Page ${index + 1}` : `Pending Page ${index + 1}`,
				start_time: '2026-12-01T09:00:00.000Z',
				location: { name: 'District Filter' },
			},
		})));

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: /Trang sau|Next page/i }).click();
		await expectPageIndicator(page, 2, 2);

		await selectStatusFilter(page, 'Pending');

		await expect(desktopRows(page)).toHaveCount(2);
		await expectPageIndicator(page, 1, 1);
		await expect(page.getByRole('button', { name: /Trang trước|Previous page/i })).toBeDisabled();
		await expect(page.getByRole('button', { name: /Trang sau|Next page/i })).toBeDisabled();
	});

	test('shows page 1 / 1 without errors when there are no rows', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'page-empty@example.com' });
		await mockRegistrations(page, []);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await expectPageIndicator(page, 1, 1);
		await expect(page.getByRole('button', { name: /Trang trước|Previous page/i })).toBeDisabled();
		await expect(page.getByRole('button', { name: /Trang sau|Next page/i })).toBeDisabled();
		await expect(page.getByRole('heading', { name: /Campaigns you registered/i })).toBeVisible();
	});
});

test.describe('ShowCampaignJoin view details', () => {
	test('desktop view details navigates to /events/:id', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'details-desktop@example.com' });
		await mockRegistrations(page, [makeRegistration({ event_id: 501, event: { id: 501, title: 'Desktop Detail Campaign', name: 'Desktop Detail Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Detail' } } })]);
		await page.route('http://localhost:4000/events/501', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 501, title: 'Desktop Detail Campaign', status: 'active', start_time: '2026-12-01T09:00:00.000Z', end_time: '2026-12-02T09:00:00.000Z', location: { name: 'District Detail' } }) }),
		);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await page.locator('tr', { hasText: 'Desktop Detail Campaign' }).first().getByRole('button', { name: /View details|Xem chi tiết/i }).click();

		await expect(page).toHaveURL(/\/events\/501$/);
	});

	test('mobile view details navigates to /events/:id', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await loginAsVolunteer(page, { email: 'details-mobile@example.com' });
		await mockRegistrations(page, [makeRegistration({ event_id: 502, event: { id: 502, title: 'Mobile Detail Campaign', name: 'Mobile Detail Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Detail' } } })]);
		await page.route('http://localhost:4000/events/502', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 502, title: 'Mobile Detail Campaign', status: 'active', start_time: '2026-12-01T09:00:00.000Z', end_time: '2026-12-02T09:00:00.000Z', location: { name: 'District Detail' } }) }),
		);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await page.locator('div.md\\:hidden table tr', { hasText: 'Mobile Detail Campaign' }).getByRole('button', { name: /View details|Xem chi tiết/i }).click();

		await expect(page).toHaveURL(/\/events\/502$/);
	});

	test('invalid event detail route falls back without crashing the app', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'details-invalid@example.com' });
		await mockRegistrations(page, [makeRegistration({ event_id: 999, event: { id: 999, title: 'Broken Detail Campaign', name: 'Broken Detail Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Detail' } } })]);
		await page.route('http://localhost:4000/events/999', (route) =>
			route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) }),
		);
		await mockDashboard(page);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await page.locator('tr', { hasText: 'Broken Detail Campaign' }).first().getByRole('button', { name: /View details|Xem chi tiết/i }).click();

		await page.waitForURL(/\/$/, { timeout: 5000 });
		await expect(page).toHaveURL(/\/$/);
	});
});

test.describe('ShowCampaignJoin cancel registration', () => {
	test('pending and eligible future registrations show cancel and open confirmation dialog', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'cancel-visible@example.com' });
		await mockRegistrations(page, [
			makeRegistration({ event_id: 601, status: 'pending', event: { id: 601, title: 'Pending Cancel Campaign', name: 'Pending Cancel Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Cancel' } } }),
			makeRegistration({ event_id: 602, status: 'approved', event: { id: 602, title: 'Future Cancel Campaign', name: 'Future Cancel Campaign', start_time: '2026-12-02T09:00:00.000Z', location: { name: 'District Cancel' } } }),
		]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await expect(page.locator('tr', { hasText: 'Pending Cancel Campaign' }).first().getByRole('button', { name: /Cancel registration|Hủy đăng ký/i })).toBeVisible();
		await expect(page.locator('tr', { hasText: 'Future Cancel Campaign' }).first().getByRole('button', { name: /Cancel registration|Hủy đăng ký/i })).toBeVisible();

		await clickCancelRegistration(page, 'Pending Cancel Campaign');
		await expect(page.getByRole('heading', { name: /Cancel registration|Hủy đăng ký/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Confirm|Xác nhận/i })).toBeVisible();
	});

	test('rejected, completed, and past registrations do not show cancel', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'cancel-hidden@example.com' });
		await mockRegistrations(page, [
			makeRegistration({ event_id: 611, status: 'rejected', event: { id: 611, title: 'Rejected Cancel Campaign', name: 'Rejected Cancel Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Cancel' } } }),
			makeRegistration({ event_id: 612, status: 'completed', event: { id: 612, title: 'Completed Cancel Campaign', name: 'Completed Cancel Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Cancel' } } }),
			makeRegistration({ event_id: 613, status: 'approved', event: { id: 613, title: 'Past Cancel Campaign', name: 'Past Cancel Campaign', start_time: '2024-01-01T09:00:00.000Z', location: { name: 'District Cancel' } } }),
		]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await expect(page.locator('tr', { hasText: 'Rejected Cancel Campaign' }).first().getByRole('button', { name: /Cancel registration|Hủy đăng ký/i })).toHaveCount(0);
		await expect(page.locator('tr', { hasText: 'Completed Cancel Campaign' }).first().getByRole('button', { name: /Cancel registration|Hủy đăng ký/i })).toHaveCount(0);
		await expect(page.locator('tr', { hasText: 'Past Cancel Campaign' }).first().getByRole('button', { name: /Cancel registration|Hủy đăng ký/i })).toHaveCount(0);
	});

	test('clicking dialog cancel closes it without calling the cancel API', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'cancel-dialog-cancel@example.com' });
		let patchCalls = 0;
		await mockRegistrations(page, [makeRegistration({ event_id: 621, status: 'pending', event: { id: 621, title: 'Dialog Cancel Campaign', name: 'Dialog Cancel Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Cancel' } } })]);
		await page.route('http://localhost:4000/registrations/621/register', (route) => {
			if (route.request().method() === 'PATCH') patchCalls += 1;
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'cancelled' }) });
		});

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await clickCancelRegistration(page, 'Dialog Cancel Campaign');
		await page.getByRole('button', { name: /^Cancel$|^Hủy$/i }).click();

		await expect(page.getByRole('dialog')).toHaveCount(0);
		expect(patchCalls).toBe(0);
	});

	test('confirming cancel calls PATCH, shows success, refreshes list, and removes cancelled rows', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'cancel-success@example.com' });
		const before = [
			makeRegistration({ event_id: 631, status: 'pending', event: { id: 631, title: 'Cancel Success Campaign', name: 'Cancel Success Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Cancel' } } }),
			makeRegistration({ event_id: 632, status: 'approved', event: { id: 632, title: 'Remaining Campaign', name: 'Remaining Campaign', start_time: '2026-12-02T09:00:00.000Z', location: { name: 'District Cancel' } } }),
		];
		let cancelled = false;
		await page.route('http://localhost:4000/registrations/my', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(cancelled ? [{ ...before[0], status: 'cancelled' }, before[1]] : before),
			}),
		);
		let patchCalls = 0;
		await page.route('http://localhost:4000/registrations/631/register', (route) => {
			if (route.request().method() === 'PATCH') patchCalls += 1;
			cancelled = true;
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'cancelled' }) });
		});

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await clickCancelRegistration(page, 'Cancel Success Campaign');
		await page.getByRole('button', { name: /Confirm|Xác nhận/i }).click();

		await expect(page.getByRole('alert')).toContainText(/Cancelled successfully|Cancel registration success|Hủy đăng ký thành công/i, { timeout: 8000 });
		expect(patchCalls).toBe(1);
		await expect(desktopCell(page, 'Cancel Success Campaign')).toHaveCount(0);
		await expect(desktopCell(page, 'Remaining Campaign')).toBeVisible();
	});

	test('cancel API error shows an error snackbar and keeps the dialog open', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'cancel-error@example.com' });
		await mockRegistrations(page, [makeRegistration({ event_id: 641, status: 'pending', event: { id: 641, title: 'Cancel Error Campaign', name: 'Cancel Error Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Cancel' } } })]);
		await page.route('http://localhost:4000/registrations/641/register', (route) =>
			route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Cannot cancel this registration' }) }),
		);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await clickCancelRegistration(page, 'Cancel Error Campaign');
		await page.getByRole('button', { name: /Confirm|Xác nhận/i }).click();

		await expect(page.locator('.MuiAlert-root')).toContainText(/Cannot cancel this registration|Cancel failed|Hủy thất bại/i, { timeout: 8000 });
		await expect(page.getByRole('dialog')).toBeVisible();
	});

	test('slow cancel shows loading, blocks double submit, and ignores backdrop close while pending', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'cancel-slow@example.com' });
		let cancelled = false;
		const item = makeRegistration({ event_id: 651, status: 'pending', event: { id: 651, title: 'Slow Cancel Campaign', name: 'Slow Cancel Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Cancel' } } });
		await page.route('http://localhost:4000/registrations/my', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cancelled ? [] : [item]) }),
		);
		let release: (() => void) | undefined;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		let patchCalls = 0;
		await page.route('http://localhost:4000/registrations/651/register', async (route) => {
			patchCalls += 1;
			await gate;
			cancelled = true;
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'cancelled' }) });
		});

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await clickCancelRegistration(page, 'Slow Cancel Campaign');
		const confirmButton = page.getByRole('dialog').locator('button').last();
		await confirmButton.click();

		await expect(confirmButton).toBeDisabled();
		await expect(page.getByRole('progressbar')).toBeVisible();
		await page.mouse.click(20, 20);
		await expect(page.getByRole('dialog')).toBeVisible();
		await confirmButton.click({ force: true });
		expect(patchCalls).toBe(1);

		release?.();
		await expect(page.getByRole('alert')).toContainText(/Cancelled successfully|Cancel registration success|Hủy đăng ký thành công/i, { timeout: 8000 });
	});

	test('when refresh after cancel fails, local fallback still removes the cancelled item', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'cancel-refresh-fallback@example.com' });
		const item = makeRegistration({ event_id: 661, status: 'pending', event: { id: 661, title: 'Fallback Cancel Campaign', name: 'Fallback Cancel Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Cancel' } } });
		let cancelled = false;
		await page.route('http://localhost:4000/registrations/my', (route) =>
			route.fulfill({ status: cancelled ? 500 : 200, contentType: 'application/json', body: JSON.stringify(cancelled ? [] : [item]) }),
		);
		await page.route('http://localhost:4000/registrations/661/register', (route) => {
			cancelled = true;
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'cancelled' }) });
		});

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await clickCancelRegistration(page, 'Fallback Cancel Campaign');
		await page.getByRole('button', { name: /Confirm|Xác nhận/i }).click();

		await expect(page.getByRole('alert')).toContainText(/Cancelled successfully|Cancel registration success|Hủy đăng ký thành công/i, { timeout: 8000 });
		await expect(desktopCell(page, 'Fallback Cancel Campaign')).toHaveCount(0);
	});
});

test.describe('ShowCampaignJoin snackbar feedback', () => {
	test('success snackbar is readable on desktop and closes automatically', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'snackbar-success@example.com' });
		const item = makeRegistration({ event_id: 701, status: 'pending', event: { id: 701, title: 'Snackbar Success Campaign', name: 'Snackbar Success Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Snackbar' } } });
		let cancelled = false;
		await page.route('http://localhost:4000/registrations/my', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cancelled ? [] : [item]) }),
		);
		await page.route('http://localhost:4000/registrations/701/register', (route) => {
			cancelled = true;
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'cancelled' }) });
		});

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await clickCancelRegistration(page, 'Snackbar Success Campaign');
		await page.getByRole('button', { name: /Confirm|Xác nhận/i }).click();

		const alert = page.locator('.MuiAlert-root');
		await expect(alert).toContainText(/Cancelled successfully|Cancel registration success|Hủy đăng ký thành công/i, { timeout: 8000 });
		await expect(alert).toHaveClass(/MuiAlert-filledSuccess/);
		await expect(alert).toBeHidden({ timeout: 5000 });
	});

	test('error snackbar is readable on mobile and click away does not break it', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'snackbar-error@example.com' });
		await mockRegistrations(page, [makeRegistration({ event_id: 702, status: 'pending', event: { id: 702, title: 'Snackbar Error Campaign', name: 'Snackbar Error Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Snackbar' } } })]);
		await page.route('http://localhost:4000/registrations/702/register', (route) =>
			route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Cancel failed by policy' }) }),
		);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await clickCancelRegistration(page, 'Snackbar Error Campaign');
		await page.getByRole('button', { name: /Confirm|Xác nhận/i }).click();

		const alert = page.locator('.MuiAlert-root');
		await expect(alert).toContainText(/Cancel failed by policy|Cancel failed|Hủy thất bại/i, { timeout: 8000 });
		await expect(alert).toHaveClass(/MuiAlert-filledError/);
		await page.setViewportSize({ width: 390, height: 844 });
		const box = await alert.boundingBox();
		expect(box).toBeTruthy();
		expect(box!.width).toBeLessThanOrEqual(390);
		await page.mouse.click(10, 10);
		await expect(alert).toContainText(/Cancel failed by policy|Cancel failed|Hủy thất bại/i);
	});
});

test.describe('ShowCampaignJoin edge cases and resilience', () => {
	test('renders duplicate event ids with different statuses using stable rows', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'duplicate-event@example.com' });
		await mockRegistrations(page, [
			makeRegistration({ id: 801, event_id: 801, status: 'approved', event: { id: 801, title: 'Duplicate Event Approved', name: 'Duplicate Event Approved', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Edge' } } }),
			makeRegistration({ id: 802, event_id: 801, status: 'pending', event: { id: 801, title: 'Duplicate Event Pending', name: 'Duplicate Event Pending', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Edge' } } }),
		]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await expect(desktopRows(page)).toHaveCount(2);
		await expect(desktopCell(page, 'Duplicate Event Approved')).toBeVisible();
		await expect(desktopCell(page, 'Duplicate Event Pending')).toBeVisible();
	});

	test('mixed-case statuses and backend Absent values filter correctly', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'mixed-status@example.com' });
		await mockRegistrations(page, [
			makeRegistration({ id: 811, event_id: 811, status: 'APPROVED', event: { id: 811, title: 'Upper Approved Campaign', name: 'Upper Approved Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Edge' } } }),
			makeRegistration({ id: 812, event_id: 812, status: 'pending', event: { id: 812, title: 'Lower Pending Campaign', name: 'Lower Pending Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Edge' } } }),
			makeRegistration({ id: 813, event_id: 813, status: 'Absent', event: { id: 813, title: 'Backend Absent Campaign', name: 'Backend Absent Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Edge' } } }),
		]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await selectStatusFilter(page, 'Joined');
		await expect(desktopCell(page, 'Upper Approved Campaign')).toBeVisible();
		await expect(desktopCell(page, 'Lower Pending Campaign')).toHaveCount(0);

		await selectStatusFilter(page, 'Absent');
		await expect(desktopCell(page, 'Backend Absent Campaign')).toBeVisible();
		await expect(desktopCell(page, 'Upper Approved Campaign')).toHaveCount(0);
	});

	test('null or undefined-like status values do not break rendering', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'null-status@example.com' });
		await mockRegistrations(page, [
			makeRegistration({ id: 821, event_id: 821, status: null, event: { id: 821, title: 'Null Status Campaign', name: 'Null Status Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Edge' } } }),
			makeRegistration({ id: 822, event_id: 822, status: undefined, event: { id: 822, title: 'Undefined Status Campaign', name: 'Undefined Status Campaign', start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Edge' } } }),
		]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await expect(desktopCell(page, 'Null Status Campaign')).toBeVisible();
		await expect(desktopCell(page, 'Undefined Status Campaign')).toBeVisible();
		await expect(desktopRows(page)).toHaveCount(2);
	});

	test('reload on /mycampaigns fetches the list again from the API', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loginAsVolunteer(page, { email: 'reload-fetch@example.com' });
		let fetchCalls = 0;
		await page.route('http://localhost:4000/registrations/my', (route) => {
			fetchCalls += 1;
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([makeRegistration({ event_id: 831, event: { id: 831, title: `Reload Campaign ${fetchCalls}`, name: `Reload Campaign ${fetchCalls}`, start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Edge' } } })]),
			});
		});

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await expect(desktopCell(page, /Reload Campaign \d+/)).toBeVisible();
		const callsAfterFirstLoad = fetchCalls;

		await page.reload({ waitUntil: 'networkidle' });
		await expect(desktopCell(page, /Reload Campaign \d+/)).toBeVisible();
		expect(fetchCalls).toBeGreaterThan(callsAfterFirstLoad);
	});

	test('after token changes in localStorage, reload reflects the new API data', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const oldToken = createValidJwtToken(3600);
		const newToken = createValidJwtToken(7200);
		await setAuthState(page, {
			id: 84,
			full_name: 'Token Change Volunteer',
			email: 'token-change@example.com',
			phone: '0912345678',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		}, oldToken);
		await page.route('http://localhost:4000/registrations/my', (route) => {
			const auth = route.request().headers().authorization || '';
			const title = auth.includes(newToken) ? 'New Token Campaign' : 'Old Token Campaign';
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([makeRegistration({ event_id: 841, event: { id: 841, title, name: title, start_time: '2026-12-01T09:00:00.000Z', location: { name: 'District Edge' } } })]),
			});
		});

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });
		await expect(desktopCell(page, 'Old Token Campaign')).toBeVisible();

		await page.evaluate((tokenValue) => localStorage.setItem('token', tokenValue), newToken);
		await page.reload({ waitUntil: 'networkidle' });

		await expect(desktopCell(page, 'New Token Campaign')).toBeVisible();
	});
});

test.describe('ShowCampaignJoin access and auth', () => {
	test('allows VOLUNTEER with valid token to enter page and see registrations', async ({ page }) => {
		await setAuthState(page, {
			id: 7,
			full_name: 'Valid Volunteer',
			email: 'valid@example.com',
			phone: '0901234567',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		});
		await mockRegistrations(page, [makeRegistration()]);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'networkidle' });

		await expect(page).toHaveURL(/\/mycampaigns$/);
		await expect(page.getByRole('heading', { name: /Campaigns you registered/i })).toBeVisible();
		await expect(page.locator('tbody tr').filter({ hasText: 'Community Cleanup Day' }).first()).toBeVisible();
		await expect(page.getByText(/Joined|approved/i)).toBeVisible();
	});

	test('redirects to /login when token is missing', async ({ page }) => {
		await clearAuthState(page);

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'domcontentloaded' });

		await page.waitForURL(/\/login$/, { timeout: 5000 });
		await expect(page).toHaveURL(/\/login$/);
	});

	test('redirects to /login when user is missing', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('token', 'dummy-token');
			localStorage.removeItem('user');
		});

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'domcontentloaded' });

		await page.waitForURL(/\/login$/, { timeout: 5000 });
		await expect(page).toHaveURL(/\/login$/);
	});

	test('clears auth and redirects to /login when token is expired', async ({ page }) => {
		await setAuthState(page, {
			id: 9,
			full_name: 'Expired Volunteer',
			email: 'expired@example.com',
			phone: '0900000000',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		}, createValidJwtToken(-3600));

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'domcontentloaded' });

		await page.waitForURL(/\/login$/, { timeout: 5000 });
		await expect(page).toHaveURL(/\/login$/);
		expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
		expect(await page.evaluate(() => localStorage.getItem('user'))).toBeNull();
	});

	test('redirects to / when user is not VOLUNTEER', async ({ page }) => {
		await setAuthState(page, {
			id: 10,
			full_name: 'Admin User',
			email: 'admin@example.com',
			phone: '0912345678',
			roles: [{ role: { name: 'ADMIN' } }],
		});

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'domcontentloaded' });

		await page.waitForURL(/\/$/, { timeout: 5000 });
		await expect(page).toHaveURL(/\/$/);
	});

	test('handles invalid JSON in localStorage user safely and redirects to /', async ({ page }) => {
		await setAuthState(page, '{invalid-json', createValidJwtToken());

		await page.goto(`${BASE}/mycampaigns`, { waitUntil: 'domcontentloaded' });

		await page.waitForURL(/\/$/, { timeout: 5000 });
		await expect(page).toHaveURL(/\/$/);
	});
});
