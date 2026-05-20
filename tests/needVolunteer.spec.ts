import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

function futureIso(daysFromNow: number) {
	return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

function createValidJwtToken(expOffsetSeconds = 3600) {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds })).toString('base64url');
	return `${header}.${payload}.signature`;
}

function makeEvent(overrides: Partial<any> = {}) {
	return {
		id: 101,
		title: 'Community Cleanup Day',
		description: 'Join us to clean up local neighborhoods.',
		status: 'active',
		banner_url: 'https://example.com/community-cleanup.jpg',
		category: { name: 'Environment' },
		location: { name: 'District 1 Park' },
		start_time: futureIso(7),
		capacity: 25,
		manager: { full_name: 'Manager One' },
		total_likes: 12,
		total_comments: 3,
		...overrides,
	};
}

async function mockNeedVolunteerEvents(page: Page, events: any[], options?: { delayMs?: number }) {
	const delayMs = options?.delayMs ?? 0;

	await page.route('http://localhost:4000/events?status=active', async (route) => {
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(events),
		});
	});
}

async function mockNeedVolunteerEventsResponse(page: Page, status: number, body: unknown) {
	await page.route('http://localhost:4000/events?status=active', (route) =>
		route.fulfill({
			status,
			contentType: 'application/json',
			body: typeof body === 'string' ? body : JSON.stringify(body),
		}),
	);
}

async function mockNeedVolunteerEventsNetworkError(page: Page) {
	await page.route('http://localhost:4000/events?status=active', (route) => route.abort('failed'));
}

async function setAuthState(page: Page) {
	await page.addInitScript(({ tokenValue, userValue }) => {
		localStorage.setItem('token', tokenValue);
		localStorage.setItem('user', userValue);
	}, {
		tokenValue: createValidJwtToken(),
		userValue: JSON.stringify({
			id: 91,
			full_name: 'Need Volunteer Spec',
			email: 'need-volunteer@example.com',
			roles: [{ role: { name: 'VOLUNTEER' } }],
		}),
	});
}

async function mockEventDetail(page: Page, eventId: number, overrides: Partial<any> = {}) {
	await page.route(`http://localhost:4000/events/${eventId}`, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(makeEvent({
				id: eventId,
				title: `Detail Event ${eventId}`,
				end_time: futureIso(8),
				...overrides,
			})),
		}),
	);
	await page.route('http://localhost:4000/registrations/my', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify([]),
		}),
	);
}

function gridCards(page: Page) {
	return page.locator('div[class*="MuiCard"][class*="MuiPaper"]').filter({
		has: page.getByRole('button', { name: /View Details|Xem chi tiết/i }),
	});
}

function gridSection(page: Page) {
	return gridCards(page).first().locator('xpath=ancestor::div[contains(@class, "block") or contains(@class, "hidden")][1]');
}

function desktopListTable(page: Page) {
	return page.locator('div.hidden.md\\:block table');
}

function mobileListTable(page: Page) {
	return page.locator('div.md\\:hidden table');
}

function categorySelect(page: Page) {
	return page.locator('select').first();
}

function sortSelect(page: Page) {
	return page.locator('select').nth(1);
}

async function visibleGridTitles(page: Page) {
	return gridCards(page).evaluateAll((cards) =>
		cards.map((card) => card.querySelector('h6')?.textContent?.trim() || ''),
	);
}

async function expectNoHorizontalOverflow(page: Page) {
	const hasHorizontalOverflow = await page.locator('html').evaluate((el) => {
		const root = el as HTMLHtmlElement;
		return root.scrollWidth > window.innerWidth;
	});
	expect(hasHorizontalOverflow).toBeFalsy();
}

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function expectNeedVolunteerShell(page: Page) {
	await expect(page.getByRole('heading', { name: /Join Our Community|Volunteer Opportunities|Volunteer Needs|Cần tình nguyện viên/i })).toBeVisible({ timeout: 10000 });
	await expect(page.getByText(/Discover meaningful ways|pulse of our community engagement|cơ hội.*tình nguyện/i)).toBeVisible({ timeout: 10000 });
	await expect(page.getByRole('button', { name: 'module' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'list' })).toBeVisible();
	await expect(page.getByText(/Filter by Category|Lọc theo danh mục/i)).toBeVisible();
	await expect(page.getByText(/Sort by Deadline|Sắp xếp theo hạn/i)).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Enter the Post Title' })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Search$/i })).toBeVisible();
}

async function searchCampaigns(page: Page, keyword: string) {
	await page.getByRole('textbox', { name: 'Enter the Post Title' }).fill(keyword);
	await page.getByRole('button', { name: /^Search$/i }).click();
}

function suggestionItems(page: Page) {
	return page.locator('input[name="search"] ~ ul li');
}

test.describe('NeedVolunteer UI rendering', () => {
	test('renders the page shell, controls, and valid active future events as cards by default', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({
				id: 101,
				title: 'Community Cleanup Day',
				category: { name: 'Environment' },
				location: { name: 'District 1 Park' },
				capacity: 25,
				start_time: futureIso(5),
				total_likes: 12,
				total_comments: 3,
			}),
			makeEvent({
				id: 102,
				title: 'Food Support Campaign',
				category: { name: 'Community' },
				location: { name: 'District 2 Center' },
				capacity: 40,
				start_time: futureIso(10),
				total_likes: 8,
				total_comments: 1,
			}),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expect(page).toHaveURL(/\/need-volunteer$/);
		await expectNeedVolunteerShell(page);
		await expect(gridCards(page)).toHaveCount(2);
		await expect(page.getByRole('heading', { name: 'Community Cleanup Day' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Food Support Campaign' })).toBeVisible();
		await expect(gridCards(page).filter({ hasText: 'Community Cleanup Day' })).toContainText('Environment');
		await expect(gridCards(page).filter({ hasText: 'Food Support Campaign' })).toContainText('Community');
		await expect(gridCards(page).filter({ hasText: 'Community Cleanup Day' })).toContainText(new Date(futureIso(5)).toISOString().slice(0, 10));
		const firstCardHasImageOrFallback = await gridCards(page).filter({ hasText: 'Community Cleanup Day' }).evaluate((card) =>
			Boolean(card.querySelector('img')) || /No image|Không có hình/i.test(card.textContent || ''),
		);
		expect(firstCardHasImageOrFallback).toBeTruthy();
		await expect(page.locator('a[href="/events/101"]').getByRole('button', { name: /View Details|Xem chi tiết/i })).toBeVisible();
	});

	test('renders a no-image fallback while still showing each required card field', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({
				id: 201,
				title: 'No Banner Volunteer Campaign',
				banner_url: '',
				category: { name: 'Health' },
				start_time: futureIso(3),
				total_likes: 4,
				total_comments: 2,
			}),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNeedVolunteerShell(page);
		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'No Banner Volunteer Campaign' })).toBeVisible();
		await expect(gridCards(page).filter({ hasText: 'No Banner Volunteer Campaign' })).toContainText('Health');
		await expect(page.getByText(/No image|Không có hình/i)).toBeVisible();
		await expect(page.locator('a[href="/events/201"]').getByRole('button', { name: /View Details|Xem chi tiết/i })).toBeVisible();
	});

	test('shows the loading indicator while the events request is pending and then renders events', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		let release: (() => void) | undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route('http://localhost:4000/events?status=active', async (route) => {
			await gate;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					makeEvent({ id: 301, title: 'Delayed Cleanup Campaign', start_time: futureIso(4) }),
				]),
			});
		});

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'domcontentloaded' });
		await expectNeedVolunteerShell(page);

		const loader = page.locator('img[src^="data:image/svg+xml"]').first();
		await expect(loader).toBeVisible();
		release?.();
		await expect(page.getByRole('heading', { name: 'Delayed Cleanup Campaign' })).toBeVisible({ timeout: 6000 });
		await expect(loader).toHaveCount(0);
		await expect(gridCards(page)).toHaveCount(1);
	});

	test('handles a 500 response without crashing and keeps the page controls available', async ({ page }) => {
		const runtimeErrors: string[] = [];
		page.on('pageerror', (err) => runtimeErrors.push(err.message));
		await mockNeedVolunteerEventsResponse(page, 500, { error: 'HTTP 500' });

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNeedVolunteerShell(page);
		await expect(gridCards(page)).toHaveCount(0);
		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});

	test('handles a network error without crashing and keeps the page controls available', async ({ page }) => {
		const runtimeErrors: string[] = [];
		page.on('pageerror', (err) => runtimeErrors.push(err.message));
		await mockNeedVolunteerEventsNetworkError(page);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNeedVolunteerShell(page);
		await expect(gridCards(page)).toHaveCount(0);
		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});

	for (const scenario of [
		{ name: 'empty object', body: {} },
		{ name: 'null data wrapper', body: { data: null } },
		{ name: 'string response', body: 'not-an-array' },
		{ name: 'object response', body: { id: 1, title: 'Not an array' } },
	]) {
		test(`handles malformed API response: ${scenario.name}`, async ({ page }) => {
			const runtimeErrors: string[] = [];
			page.on('pageerror', (err) => runtimeErrors.push(err.message));
			await mockNeedVolunteerEventsResponse(page, 200, scenario.body);

			await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

			await expectNeedVolunteerShell(page);
			await expect(gridCards(page)).toHaveCount(0);
			expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
		});
	}
});

test.describe('NeedVolunteer data filtering', () => {
	test('shows only active events from the API response', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 401, title: 'Active Cleanup Campaign', status: 'active', start_time: futureIso(5) }),
			makeEvent({ id: 402, title: 'Pending Food Campaign', status: 'pending', start_time: futureIso(6) }),
			makeEvent({ id: 403, title: 'Rejected Teaching Campaign', status: 'rejected', start_time: futureIso(7) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNeedVolunteerShell(page);
		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Active Cleanup Campaign' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Pending Food Campaign' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Rejected Teaching Campaign' })).toHaveCount(0);
	});

	test('shows only active events with a valid future start time', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 411, title: 'Future Valid Campaign', status: 'active', start_time: futureIso(5) }),
			makeEvent({ id: 412, title: 'Past Active Campaign', status: 'active', start_time: futureIso(-5) }),
			makeEvent({ id: 413, title: 'Invalid Date Campaign', status: 'active', start_time: 'not-a-valid-date' }),
			makeEvent({ id: 414, title: 'Missing Date Campaign', status: 'active', start_time: undefined }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNeedVolunteerShell(page);
		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Future Valid Campaign' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Past Active Campaign' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Invalid Date Campaign' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Missing Date Campaign' })).toHaveCount(0);
	});
});

test.describe('NeedVolunteer search and suggestions', () => {
	test('searches title by partial keyword and ignores case', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 501, title: 'Community Cleanup Day', start_time: futureIso(5) }),
			makeEvent({ id: 502, title: 'Beach Clean Water Campaign', start_time: futureIso(6) }),
			makeEvent({ id: 503, title: 'Food Support Campaign', start_time: futureIso(7) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await searchCampaigns(page, 'clean');

		await expect(gridCards(page)).toHaveCount(2);
		await expect(page.getByRole('heading', { name: 'Community Cleanup Day' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Beach Clean Water Campaign' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Food Support Campaign' })).toHaveCount(0);
	});

	test('searching a non-matching keyword shows an empty list without breaking controls', async ({ page }) => {
		const runtimeErrors: string[] = [];
		page.on('pageerror', (err) => runtimeErrors.push(err.message));
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 511, title: 'Community Cleanup Day', start_time: futureIso(5) }),
			makeEvent({ id: 512, title: 'Food Support Campaign', start_time: futureIso(6) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await searchCampaigns(page, 'zzzz-not-found');

		await expect(gridCards(page)).toHaveCount(0);
		await expectNeedVolunteerShell(page);
		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);

		await searchCampaigns(page, 'Clean');
		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Community Cleanup Day' })).toBeVisible();
	});

	test('clearing the search input returns the full valid event list', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 521, title: 'Community Cleanup Day', start_time: futureIso(5) }),
			makeEvent({ id: 522, title: 'Food Support Campaign', start_time: futureIso(6) }),
			makeEvent({ id: 523, title: 'Tree Planting Campaign', start_time: futureIso(7) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await searchCampaigns(page, 'Clean');
		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Community Cleanup Day' })).toBeVisible();

		await searchCampaigns(page, '');

		await expect(gridCards(page)).toHaveCount(3);
		await expect(page.getByRole('heading', { name: 'Community Cleanup Day' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Food Support Campaign' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Tree Planting Campaign' })).toBeVisible();
	});

	test('searching whitespace follows current behavior and keeps the full list without crashing', async ({ page }) => {
		const runtimeErrors: string[] = [];
		page.on('pageerror', (err) => runtimeErrors.push(err.message));
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 531, title: 'Community Cleanup Day', start_time: futureIso(5) }),
			makeEvent({ id: 532, title: 'Food Support Campaign', start_time: futureIso(6) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await searchCampaigns(page, ' ');

		await expect(gridCards(page)).toHaveCount(2);
		await expect(page.getByRole('heading', { name: 'Community Cleanup Day' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Food Support Campaign' })).toBeVisible();
		await expectNeedVolunteerShell(page);
		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});

	test('shows at most 8 unique suggestions while typing a partial title', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 541, title: 'Clean Alpha', start_time: futureIso(5) }),
			makeEvent({ id: 542, title: 'Clean Beta', start_time: futureIso(6) }),
			makeEvent({ id: 543, title: 'Clean Gamma', start_time: futureIso(7) }),
			makeEvent({ id: 544, title: 'Clean Delta', start_time: futureIso(8) }),
			makeEvent({ id: 545, title: 'Clean Epsilon', start_time: futureIso(9) }),
			makeEvent({ id: 546, title: 'Clean Zeta', start_time: futureIso(10) }),
			makeEvent({ id: 547, title: 'Clean Eta', start_time: futureIso(11) }),
			makeEvent({ id: 548, title: 'Clean Theta', start_time: futureIso(12) }),
			makeEvent({ id: 549, title: 'Clean Iota', start_time: futureIso(13) }),
			makeEvent({ id: 550, title: 'Clean Alpha', start_time: futureIso(14) }),
			makeEvent({ id: 551, title: 'Food Support Campaign', start_time: futureIso(15) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await page.getByRole('textbox', { name: 'Enter the Post Title' }).fill('Clean');

		await expect(suggestionItems(page).first()).toBeVisible();
		await expect(suggestionItems(page)).toHaveCount(8);
		const suggestionTexts = await suggestionItems(page).allTextContents();
		expect(new Set(suggestionTexts).size).toBe(suggestionTexts.length);
		expect(suggestionTexts).toEqual(expect.arrayContaining(['Clean Alpha', 'Clean Beta']));
		expect(suggestionTexts).not.toContain('Food Support Campaign');
	});

	test('clicking a suggestion fills the input, filters the list, and closes suggestions', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 561, title: 'Clean Alpha', start_time: futureIso(5) }),
			makeEvent({ id: 562, title: 'Clean Beta', start_time: futureIso(6) }),
			makeEvent({ id: 563, title: 'Food Support Campaign', start_time: futureIso(7) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		const searchInput = page.getByRole('textbox', { name: 'Enter the Post Title' });
		await searchInput.fill('Clean');
		await suggestionItems(page).filter({ hasText: 'Clean Beta' }).click();

		await expect(searchInput).toHaveValue('Clean Beta');
		await expect(suggestionItems(page)).toHaveCount(0);
		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Clean Beta' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Clean Alpha' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Food Support Campaign' })).toHaveCount(0);
	});

	test('keyboard navigation selects the active suggestion with Enter', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 571, title: 'Clean Alpha', start_time: futureIso(5) }),
			makeEvent({ id: 572, title: 'Clean Beta', start_time: futureIso(6) }),
			makeEvent({ id: 573, title: 'Clean Gamma', start_time: futureIso(7) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		const searchInput = page.getByRole('textbox', { name: 'Enter the Post Title' });
		await searchInput.fill('Clean');
		await expect(suggestionItems(page)).toHaveCount(3);

		await searchInput.press('ArrowDown');
		await searchInput.press('ArrowUp');
		await searchInput.press('Enter');

		await expect(searchInput).toHaveValue('Clean Alpha');
		await expect(suggestionItems(page)).toHaveCount(0);
		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Clean Alpha' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Clean Beta' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Clean Gamma' })).toHaveCount(0);
	});

	test('Escape closes suggestions without clearing the input', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 581, title: 'Clean Alpha', start_time: futureIso(5) }),
			makeEvent({ id: 582, title: 'Clean Beta', start_time: futureIso(6) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		const searchInput = page.getByRole('textbox', { name: 'Enter the Post Title' });
		await searchInput.fill('Clean');
		await expect(suggestionItems(page)).toHaveCount(2);

		await searchInput.press('Escape');

		await expect(suggestionItems(page)).toHaveCount(0);
		await expect(searchInput).toHaveValue('Clean');
	});

	test('blur closes suggestions after a short delay without crashing', async ({ page }) => {
		const runtimeErrors: string[] = [];
		page.on('pageerror', (err) => runtimeErrors.push(err.message));
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 591, title: 'Clean Alpha', start_time: futureIso(5) }),
			makeEvent({ id: 592, title: 'Clean Beta', start_time: futureIso(6) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		const searchInput = page.getByRole('textbox', { name: 'Enter the Post Title' });
		await searchInput.fill('Clean');
		await expect(suggestionItems(page)).toHaveCount(2);

		await page.getByRole('heading', { name: /Join Our Community|Volunteer Opportunities|Volunteer Needs/i }).click();

		await expect(suggestionItems(page)).toHaveCount(0, { timeout: 1000 });
		await expect(searchInput).toHaveValue('Clean');
		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});
});

test.describe('NeedVolunteer category filter and deadline sort', () => {
	test('builds the category select options from event data without duplicates', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 701, title: 'Health Support Campaign', category: { name: 'Health' }, start_time: futureIso(5) }),
			makeEvent({ id: 702, title: 'Environment Cleanup Campaign', category: { name: 'Environment' }, start_time: futureIso(6) }),
			makeEvent({ id: 703, title: 'Education Workshop Campaign', category: { name: 'Education' }, start_time: futureIso(7) }),
			makeEvent({ id: 704, title: 'Environment Planting Campaign', category: { name: 'Environment' }, start_time: futureIso(8) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		const options = categorySelect(page).locator('option');
		await expect(options).toHaveText(['All', 'Health', 'Environment', 'Education']);
		const optionTexts = await options.allTextContents();
		expect(new Set(optionTexts).size).toBe(optionTexts.length);
	});

	test('filters visible cards by selected category', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 711, title: 'Health Support Campaign', category: { name: 'Health' }, start_time: futureIso(5) }),
			makeEvent({ id: 712, title: 'Environment Cleanup Campaign', category: { name: 'Environment' }, start_time: futureIso(6) }),
			makeEvent({ id: 713, title: 'Education Workshop Campaign', category: { name: 'Education' }, start_time: futureIso(7) }),
			makeEvent({ id: 714, title: 'Environment Planting Campaign', category: { name: 'Environment' }, start_time: futureIso(8) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await categorySelect(page).selectOption('Environment');

		await expect(gridCards(page)).toHaveCount(2);
		await expect(page.getByRole('heading', { name: 'Environment Cleanup Campaign' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Environment Planting Campaign' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Health Support Campaign' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Education Workshop Campaign' })).toHaveCount(0);
	});

	test('selecting All after category filtering restores all events from the current search result', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 721, title: 'Clean Health Campaign', category: { name: 'Health' }, start_time: futureIso(5) }),
			makeEvent({ id: 722, title: 'Clean Environment Campaign', category: { name: 'Environment' }, start_time: futureIso(6) }),
			makeEvent({ id: 723, title: 'Education Workshop Campaign', category: { name: 'Education' }, start_time: futureIso(7) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await searchCampaigns(page, 'Clean');
		await expect(gridCards(page)).toHaveCount(2);

		await categorySelect(page).selectOption('Environment');
		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Clean Environment Campaign' })).toBeVisible();

		await categorySelect(page).selectOption('All');

		await expect(gridCards(page)).toHaveCount(2);
		await expect(page.getByRole('heading', { name: 'Clean Health Campaign' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Clean Environment Campaign' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Education Workshop Campaign' })).toHaveCount(0);
	});

	test('combines search and category filter as an intersection', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 731, title: 'Clean Environment Campaign', category: { name: 'Environment' }, start_time: futureIso(5) }),
			makeEvent({ id: 732, title: 'Clean Health Campaign', category: { name: 'Health' }, start_time: futureIso(6) }),
			makeEvent({ id: 733, title: 'Tree Environment Campaign', category: { name: 'Environment' }, start_time: futureIso(7) }),
			makeEvent({ id: 734, title: 'Education Workshop Campaign', category: { name: 'Education' }, start_time: futureIso(8) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await searchCampaigns(page, 'Clean');
		await categorySelect(page).selectOption('Environment');

		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Clean Environment Campaign' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Clean Health Campaign' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Tree Environment Campaign' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Education Workshop Campaign' })).toHaveCount(0);
	});

	test('keeps API order when deadline sort is none by default', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 741, title: 'Later Deadline Campaign', start_time: futureIso(10) }),
			makeEvent({ id: 742, title: 'Sooner Deadline Campaign', start_time: futureIso(2) }),
			makeEvent({ id: 743, title: 'Middle Deadline Campaign', start_time: futureIso(6) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expect(sortSelect(page)).toHaveValue('none');
		expect(await visibleGridTitles(page)).toEqual([
			'Later Deadline Campaign',
			'Sooner Deadline Campaign',
			'Middle Deadline Campaign',
		]);
	});

	test('sorts deadlines ascending with the nearest valid event first', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 751, title: 'Far Future Campaign', start_time: futureIso(20) }),
			makeEvent({ id: 752, title: 'Invalid Deadline Campaign', start_time: 'not-a-valid-date' }),
			makeEvent({ id: 753, title: 'Nearest Future Campaign', start_time: futureIso(2) }),
			makeEvent({ id: 754, title: 'Middle Future Campaign', start_time: futureIso(8) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await sortSelect(page).selectOption('asc');

		expect(await visibleGridTitles(page)).toEqual([
			'Nearest Future Campaign',
			'Middle Future Campaign',
			'Far Future Campaign',
		]);
		await expect(page.getByRole('heading', { name: 'Invalid Deadline Campaign' })).toHaveCount(0);
	});

	test('sorts deadlines descending with the farthest event first', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 761, title: 'Nearest Future Campaign', start_time: futureIso(2) }),
			makeEvent({ id: 762, title: 'Far Future Campaign', start_time: futureIso(20) }),
			makeEvent({ id: 763, title: 'Middle Future Campaign', start_time: futureIso(8) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await sortSelect(page).selectOption('desc');

		expect(await visibleGridTitles(page)).toEqual([
			'Far Future Campaign',
			'Middle Future Campaign',
			'Nearest Future Campaign',
		]);
	});

	test('sorts only within the already searched and category-filtered result set', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 771, title: 'Clean Environment Later', category: { name: 'Environment' }, start_time: futureIso(10) }),
			makeEvent({ id: 772, title: 'Clean Health Soon', category: { name: 'Health' }, start_time: futureIso(2) }),
			makeEvent({ id: 773, title: 'Tree Environment Soon', category: { name: 'Environment' }, start_time: futureIso(3) }),
			makeEvent({ id: 774, title: 'Clean Environment Soon', category: { name: 'Environment' }, start_time: futureIso(4) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await searchCampaigns(page, 'Clean');
		await categorySelect(page).selectOption('Environment');
		await sortSelect(page).selectOption('asc');

		expect(await visibleGridTitles(page)).toEqual([
			'Clean Environment Soon',
			'Clean Environment Later',
		]);
		await expect(page.getByRole('heading', { name: 'Clean Health Soon' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Tree Environment Soon' })).toHaveCount(0);

		await sortSelect(page).selectOption('desc');

		expect(await visibleGridTitles(page)).toEqual([
			'Clean Environment Later',
			'Clean Environment Soon',
		]);
		await expect(page.getByRole('heading', { name: 'Clean Health Soon' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Tree Environment Soon' })).toHaveCount(0);
	});
});

test.describe('NeedVolunteer grid/list views', () => {
	test('shows grid cards by default and keeps the list table hidden', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 601, title: 'Default Grid Cleanup', start_time: futureIso(5) }),
			makeEvent({ id: 602, title: 'Default Grid Food Support', start_time: futureIso(6) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNeedVolunteerShell(page);
		await expect(gridCards(page)).toHaveCount(2);
		await expect(gridSection(page)).toBeVisible();
		await expect(desktopListTable(page)).toBeHidden();
		await expect(page.getByRole('button', { name: 'module' })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('button', { name: 'list' })).toHaveAttribute('aria-pressed', 'false');
	});

	test('switches to desktop list table with full headers and row data', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const deadline = futureIso(5).slice(0, 10);
		await mockNeedVolunteerEvents(page, [
			makeEvent({
				id: 611,
				title: 'Desktop List Cleanup',
				category: { name: 'Environment' },
				location: { name: 'Central Park' },
				start_time: `${deadline}T09:00:00.000Z`,
				capacity: 35,
				manager: { full_name: 'Manager List' },
			}),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'list' }).click();

		const table = desktopListTable(page);
		await expect(table).toBeVisible();
		await expect(gridSection(page)).toBeHidden();
		await expect(table.locator('thead th')).toHaveText([
			'#',
			'Post Title',
			'Posted By',
			'Category',
			'Deadline',
			'Location',
			'Volunteer Needed',
			'View Details',
		]);

		const row = table.locator('tbody tr').filter({ hasText: 'Desktop List Cleanup' });
		await expect(row).toBeVisible();
		await expect(row).toContainText('1');
		await expect(row).toContainText('Manager List');
		await expect(row).toContainText('Environment');
		await expect(row).toContainText(deadline);
		await expect(row).toContainText('Central Park');
		await expect(row).toContainText('35');
		await expect(row.getByRole('button', { name: /View Details|Xem chi tiết/i })).toBeVisible();
	});

	test('switches from list view back to grid without losing data', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 621, title: 'Round Trip Cleanup', start_time: futureIso(5) }),
			makeEvent({ id: 622, title: 'Round Trip Teaching', start_time: futureIso(6) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'list' }).click();
		await expect(desktopListTable(page)).toBeVisible();
		await expect(gridSection(page)).toBeHidden();

		await page.getByRole('button', { name: 'module' }).click();

		await expect(gridSection(page)).toBeVisible();
		await expect(desktopListTable(page)).toBeHidden();
		await expect(gridCards(page)).toHaveCount(2);
		await expect(page.getByRole('heading', { name: 'Round Trip Cleanup' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Round Trip Teaching' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'module' })).toHaveAttribute('aria-pressed', 'true');
	});

	test('mobile list view shows the compact table without horizontal page overflow', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const deadline = futureIso(5).slice(0, 10);
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 631, title: 'Mobile List Cleanup', start_time: `${deadline}T09:00:00.000Z` }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'list' }).click();

		await expect(desktopListTable(page)).toBeHidden();
		const mobileTable = mobileListTable(page);
		await expect(mobileTable).toBeVisible();
		await expect(mobileTable.locator('thead th')).toHaveText(['Post Title', 'Deadline', 'View Details']);
		const row = mobileTable.locator('tbody tr').filter({ hasText: 'Mobile List Cleanup' });
		await expect(row).toBeVisible();
		await expect(row).toContainText(deadline);
		await expect(row.getByRole('button', { name: /View Details|Xem chi tiết/i })).toBeVisible();

		const hasHorizontalOverflow = await page.locator('html').evaluate((el) => {
			const root = el as HTMLHtmlElement;
			return root.scrollWidth > window.innerWidth;
		});
		expect(hasHorizontalOverflow).toBeFalsy();
	});
});

test.describe('NeedVolunteer navigation', () => {
	test('grid View Details navigates to the event detail route', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page);
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 101, title: 'Grid Detail Campaign', start_time: futureIso(5) }),
		]);
		await mockEventDetail(page, 101, { title: 'Grid Detail Campaign' });

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await gridCards(page).filter({ hasText: 'Grid Detail Campaign' }).getByRole('button', { name: /View Details|Xem chi tiết/i }).click();

		await expect(page).toHaveURL(/\/events\/101$/);
	});

	test('desktop list View Details navigates to the event detail route', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page);
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 801, title: 'Desktop List Detail Campaign', start_time: futureIso(5) }),
		]);
		await mockEventDetail(page, 801, { title: 'Desktop List Detail Campaign' });

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'list' }).click();
		await desktopListTable(page).locator('tbody tr').filter({ hasText: 'Desktop List Detail Campaign' }).getByRole('button', { name: /View Details|Xem chi tiết/i }).click();

		await expect(page).toHaveURL(/\/events\/801$/);
	});

	test('mobile list View Details navigates to the event detail route', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await setAuthState(page);
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 802, title: 'Mobile List Detail Campaign', start_time: futureIso(5) }),
		]);
		await mockEventDetail(page, 802, { title: 'Mobile List Detail Campaign' });

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'list' }).click();
		await mobileListTable(page).locator('tbody tr').filter({ hasText: 'Mobile List Detail Campaign' }).getByRole('button', { name: /View Details|Xem chi tiết/i }).click();

		await expect(page).toHaveURL(/\/events\/802$/);
	});
});

test.describe('NeedVolunteer responsive and accessibility', () => {
	test('desktop layout keeps header, controls, grid, and table within the viewport', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 901, title: 'Desktop Layout Alpha', start_time: futureIso(5) }),
			makeEvent({ id: 902, title: 'Desktop Layout Beta', start_time: futureIso(6) }),
			makeEvent({ id: 903, title: 'Desktop Layout Gamma', start_time: futureIso(7) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNoHorizontalOverflow(page);
		const headerBox = await page.getByRole('heading', { name: /Join Our Community|Volunteer Opportunities|Volunteer Needs/i }).boundingBox();
		const toggleBox = await page.locator('.MuiToggleButtonGroup-root').first().boundingBox();
		const searchBox = await page.getByRole('textbox', { name: 'Enter the Post Title' }).locator('xpath=ancestor::div[contains(@class, "relative")][1]').boundingBox();
		const categoryBox = await categorySelect(page).boundingBox();
		const sortBox = await sortSelect(page).boundingBox();
		expect(headerBox).toBeTruthy();
		expect(toggleBox).toBeTruthy();
		expect(searchBox).toBeTruthy();
		expect(categoryBox).toBeTruthy();
		expect(sortBox).toBeTruthy();
		expect(boxesOverlap(headerBox!, toggleBox!)).toBeFalsy();
		expect(boxesOverlap(headerBox!, searchBox!)).toBeFalsy();
		expect(categoryBox!.width).toBeGreaterThan(0);
		expect(sortBox!.width).toBeGreaterThan(0);

		const cardBoxes = await Promise.all([0, 1, 2].map((index) => gridCards(page).nth(index).boundingBox()));
		for (const box of cardBoxes) {
			expect(box).toBeTruthy();
		}
		expect(Math.abs(cardBoxes[0]!.y - cardBoxes[1]!.y)).toBeLessThan(20);
		expect(Math.abs(cardBoxes[1]!.y - cardBoxes[2]!.y)).toBeLessThan(20);
		expect(cardBoxes[0]!.x).toBeLessThan(cardBoxes[1]!.x);
		expect(cardBoxes[1]!.x).toBeLessThan(cardBoxes[2]!.x);

		await page.getByRole('button', { name: 'list' }).click();
		await expect(desktopListTable(page)).toBeVisible();
		await expectNoHorizontalOverflow(page);
	});

	test('tablet layout keeps cards readable and controls from overlapping the header', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 911, title: 'Tablet Layout Cleanup', start_time: futureIso(5) }),
			makeEvent({ id: 912, title: 'Tablet Layout Teaching', start_time: futureIso(6) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNoHorizontalOverflow(page);
		await expect(gridCards(page)).toHaveCount(2);
		const headerBox = await page.getByRole('heading', { name: /Join Our Community|Volunteer Opportunities|Volunteer Needs/i }).boundingBox();
		const toggleBox = await page.locator('.MuiToggleButtonGroup-root').first().boundingBox();
		const searchBox = await page.getByRole('textbox', { name: 'Enter the Post Title' }).locator('xpath=ancestor::div[contains(@class, "relative")][1]').boundingBox();
		expect(headerBox).toBeTruthy();
		expect(toggleBox).toBeTruthy();
		expect(searchBox).toBeTruthy();
		expect(boxesOverlap(headerBox!, toggleBox!)).toBeFalsy();
		expect(boxesOverlap(headerBox!, searchBox!)).toBeFalsy();

		for (let index = 0; index < 2; index += 1) {
			const cardBox = await gridCards(page).nth(index).boundingBox();
			expect(cardBox).toBeTruthy();
			expect(cardBox!.width).toBeGreaterThan(250);
		}
	});

	test('mobile layout avoids horizontal overflow and keeps search, filters, and text usable', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 921, title: 'Mobile Layout Cleanup Campaign', category: { name: 'Environment' }, start_time: futureIso(5) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNoHorizontalOverflow(page);
		const searchInput = page.getByRole('textbox', { name: 'Enter the Post Title' });
		const searchButton = page.getByRole('button', { name: /^Search$/i });
		await expect(searchInput).toBeVisible();
		await expect(searchButton).toBeVisible();
		const inputBox = await searchInput.boundingBox();
		const buttonBox = await searchButton.boundingBox();
		expect(inputBox).toBeTruthy();
		expect(buttonBox).toBeTruthy();
		expect(inputBox!.x).toBeGreaterThanOrEqual(0);
		expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(375);

		await categorySelect(page).selectOption('Environment');
		await sortSelect(page).selectOption('asc');
		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Mobile Layout Cleanup Campaign' })).toBeVisible();

		await page.getByRole('button', { name: 'list' }).click();
		await expect(mobileListTable(page)).toBeVisible();
		await expectNoHorizontalOverflow(page);
	});

	test('long content wraps or truncates without breaking layout or creating overflow', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const longTitle = 'Very Long Volunteer Campaign Title '.repeat(8).trim();
		const longLocation = 'Very Long Location Name '.repeat(12).trim();
		const longManagerName = 'Very Long Manager Name '.repeat(8).trim();
		await mockNeedVolunteerEvents(page, [
			makeEvent({
				id: 931,
				title: longTitle,
				location: { name: longLocation },
				manager: { full_name: longManagerName },
				start_time: futureIso(5),
			}),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNoHorizontalOverflow(page);
		await expect(gridCards(page)).toHaveCount(1);
		const cardBox = await gridCards(page).first().boundingBox();
		expect(cardBox).toBeTruthy();
		expect(cardBox!.width).toBeLessThanOrEqual(460);

		await page.getByRole('button', { name: 'list' }).click();
		await expect(desktopListTable(page)).toBeVisible();
		await expect(desktopListTable(page).locator('tbody tr').first()).toContainText(longLocation);
		await expect(desktopListTable(page).locator('tbody tr').first()).toContainText(longManagerName);
		await expectNoHorizontalOverflow(page);
	});
});

test.describe('NeedVolunteer error and edge cases', () => {
	test('shows no cards or rows after an empty API response and keeps controls available', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, []);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNeedVolunteerShell(page);
		await expect(gridCards(page)).toHaveCount(0);
		await expect(page.locator('img[src^="data:image/svg+xml"]')).toHaveCount(0);
		await page.getByRole('button', { name: 'list' }).click();
		await expect(desktopListTable(page)).toBeVisible();
		await expect(desktopListTable(page).locator('tbody tr')).toHaveCount(0);
	});

	test('renders no events and does not crash when every API event is inactive or past', async ({ page }) => {
		const runtimeErrors: string[] = [];
		page.on('pageerror', (err) => runtimeErrors.push(err.message));
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 941, title: 'Inactive Campaign', status: 'inactive', start_time: futureIso(5) }),
			makeEvent({ id: 942, title: 'Pending Campaign', status: 'pending', start_time: futureIso(6) }),
			makeEvent({ id: 943, title: 'Past Active Campaign', status: 'active', start_time: futureIso(-2) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expectNeedVolunteerShell(page);
		await expect(gridCards(page)).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Inactive Campaign' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Pending Campaign' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Past Active Campaign' })).toHaveCount(0);
		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});

	test('search with no result clears old grid cards and table rows', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 951, title: 'Clean Health Campaign', category: { name: 'Health' }, start_time: futureIso(5) }),
			makeEvent({ id: 952, title: 'Clean Education Campaign', category: { name: 'Education' }, start_time: futureIso(6) }),
			makeEvent({ id: 953, title: 'Tree Environment Campaign', category: { name: 'Environment' }, start_time: futureIso(7) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await expect(gridCards(page)).toHaveCount(3);

		await searchCampaigns(page, 'zzzz-no-result');

		await expect(gridCards(page)).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Clean Health Campaign' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Clean Education Campaign' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Tree Environment Campaign' })).toHaveCount(0);

		await page.getByRole('button', { name: 'list' }).click();
		await expect(desktopListTable(page)).toBeVisible();
		await expect(desktopListTable(page).locator('tbody tr')).toHaveCount(0);
	});
});

test.describe('NeedVolunteer state and refresh', () => {
	test('reload fetches /events?status=active again and renders the refreshed data', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		let eventFetchCalls = 0;
		let responseVersion = 'A';
		await page.route('http://localhost:4000/events?status=active', (route) => {
			eventFetchCalls += 1;
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					makeEvent({
						id: responseVersion === 'A' ? 961 : 962,
						title: `Reload Event ${responseVersion}`,
						start_time: responseVersion === 'A' ? futureIso(5) : futureIso(6),
					}),
				]),
			});
		});

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: 'Reload Event A' })).toBeVisible();
		const callsAfterFirstLoad = eventFetchCalls;
		expect(callsAfterFirstLoad).toBeGreaterThan(0);

		responseVersion = 'B';
		await page.reload({ waitUntil: 'networkidle' });

		await expect(page.getByRole('heading', { name: 'Reload Event B' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Reload Event A' })).toHaveCount(0);
		expect(eventFetchCalls).toBeGreaterThan(callsAfterFirstLoad);
	});

	test('back from event detail renders the page without crashing and resets transient filters', async ({ page }) => {
		const runtimeErrors: string[] = [];
		page.on('pageerror', (err) => runtimeErrors.push(err.message));
		await page.setViewportSize({ width: 1440, height: 900 });
		await setAuthState(page);
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 971, title: 'Clean Environment Soon', category: { name: 'Environment' }, start_time: futureIso(2) }),
			makeEvent({ id: 972, title: 'Clean Health Later', category: { name: 'Health' }, start_time: futureIso(8) }),
			makeEvent({ id: 973, title: 'Tree Environment Middle', category: { name: 'Environment' }, start_time: futureIso(5) }),
		]);
		await mockEventDetail(page, 971, { title: 'Clean Environment Soon' });

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });
		await searchCampaigns(page, 'Clean');
		await categorySelect(page).selectOption('Environment');
		await sortSelect(page).selectOption('asc');
		await expect(gridCards(page)).toHaveCount(1);

		await gridCards(page).filter({ hasText: 'Clean Environment Soon' }).getByRole('button', { name: /View Details|Xem chi tiết/i }).click();
		await expect(page).toHaveURL(/\/events\/971$/);

		await page.goBack({ waitUntil: 'networkidle' });

		await expect(page).toHaveURL(/\/need-volunteer$/);
		await expectNeedVolunteerShell(page);
		await expect(page.getByRole('textbox', { name: 'Enter the Post Title' })).toHaveValue('');
		await expect(categorySelect(page)).toHaveValue('All');
		await expect(sortSelect(page)).toHaveValue('none');
		await expect(gridCards(page)).toHaveCount(3);
		expect(await visibleGridTitles(page)).toEqual([
			'Clean Environment Soon',
			'Clean Health Later',
			'Tree Environment Middle',
		]);
		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});

	test('repeated search, filter, sort, and view changes do not duplicate or stale the rendered data', async ({ page }) => {
		const runtimeErrors: string[] = [];
		page.on('pageerror', (err) => runtimeErrors.push(err.message));
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockNeedVolunteerEvents(page, [
			makeEvent({ id: 981, title: 'Clean Alpha Environment', category: { name: 'Environment' }, start_time: futureIso(10) }),
			makeEvent({ id: 982, title: 'Food Beta Health', category: { name: 'Health' }, start_time: futureIso(4) }),
			makeEvent({ id: 983, title: 'Clean Gamma Environment', category: { name: 'Environment' }, start_time: futureIso(2) }),
		]);

		await page.goto(`${BASE}/need-volunteer`, { waitUntil: 'networkidle' });

		await expect(gridCards(page)).toHaveCount(3);
		await page.getByRole('button', { name: 'list' }).click();
		await expect(desktopListTable(page).locator('tbody tr')).toHaveCount(3);
		await page.getByRole('button', { name: 'module' }).click();
		await expect(gridCards(page)).toHaveCount(3);

		await searchCampaigns(page, 'Clean');
		await expect(gridCards(page)).toHaveCount(2);
		await expect(page.getByRole('heading', { name: 'Food Beta Health' })).toHaveCount(0);

		await searchCampaigns(page, 'Food');
		await expect(gridCards(page)).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Food Beta Health' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Clean Alpha Environment' })).toHaveCount(0);

		await searchCampaigns(page, '');
		await expect(gridCards(page)).toHaveCount(3);

		await categorySelect(page).selectOption('All');
		await expect(gridCards(page)).toHaveCount(3);
		await categorySelect(page).selectOption('Environment');
		await expect(gridCards(page)).toHaveCount(2);
		await expect(page.getByRole('heading', { name: 'Food Beta Health' })).toHaveCount(0);

		await sortSelect(page).selectOption('asc');
		expect(await visibleGridTitles(page)).toEqual(['Clean Gamma Environment', 'Clean Alpha Environment']);
		await sortSelect(page).selectOption('desc');
		expect(await visibleGridTitles(page)).toEqual(['Clean Alpha Environment', 'Clean Gamma Environment']);
		await sortSelect(page).selectOption('none');
		expect(await visibleGridTitles(page)).toEqual(['Clean Alpha Environment', 'Clean Gamma Environment']);

		await page.getByRole('button', { name: 'list' }).click();
		await expect(desktopListTable(page).locator('tbody tr')).toHaveCount(2);
		await page.getByRole('button', { name: 'module' }).click();
		await expect(gridCards(page)).toHaveCount(2);
		expect(await visibleGridTitles(page)).toEqual(['Clean Alpha Environment', 'Clean Gamma Environment']);
		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});
});
