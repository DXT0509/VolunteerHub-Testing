import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const BASE = 'http://localhost:5173';

function createValidJwtToken(expOffsetSeconds = 3600) {
	const encodeBase64Url = (value: string) => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
	const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = encodeBase64Url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }));
	return `${header}.${payload}.signature`;
}

async function setAuthState(page: Page, user: any, token = createValidJwtToken()) {
	await page.addInitScript(({ tokenValue, userValue }) => {
		localStorage.setItem('token', tokenValue);
		localStorage.setItem('user', userValue);
	}, {
		tokenValue: token,
		userValue: JSON.stringify(user),
	});
}

async function clearAuthState(page: Page) {
	await page.addInitScript(() => {
		localStorage.removeItem('token');
		localStorage.removeItem('user');
	});
}

async function mockEventDetail(page: Page, eventId: number, eventData: any, status = 200) {
	await page.route(`http://localhost:4000/events/${eventId}`, (route) =>
		route.fulfill({
			status,
			contentType: 'application/json',
			body: JSON.stringify(eventData),
		})
	);
}

async function mockRegistrationSubmit(
	page: Page,
	eventId: number,
	options: {
		status?: number;
		body?: any;
		onRequest?: (headers: Record<string, string>) => void;
	} = {}
) {
	const { status = 200, body = { success: true }, onRequest } = options;
	let requestCount = 0;
	let pendingRoute: any = null;

	await page.route(`http://localhost:4000/registrations/${eventId}/register`, (route) => {
		requestCount += 1;
		if (onRequest) {
			onRequest(route.request().headers());
		}
		pendingRoute = route;
	});

	return {
		get requestCount() {
			return requestCount;
		},
		async fulfill() {
			if (!pendingRoute) {
				throw new Error('Expected a pending registration request but none was captured.');
			}
			await pendingRoute.fulfill({
				status,
				contentType: 'application/json',
				body: JSON.stringify(body),
			});
		},
	};
}

function makeEvent(overrides: Partial<any> = {}) {
	return {
		id: 101,
		title: 'Community Cleanup Day',
		name: 'Community Cleanup Day',
		...overrides,
	};
}

test.describe('BeVolunteerForm access and UI', () => {
	test('redirects to /login when token is missing', async ({ page }) => {
		await clearAuthState(page);
		await mockEventDetail(page, 101, makeEvent());

		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'domcontentloaded' });

		await page.waitForURL(/\/login$/, { timeout: 5000 });
		await expect(page).toHaveURL(/\/login$/);
	});

	test('redirects to /login when user is missing', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.removeItem('user');
			localStorage.setItem('token', 'dummy-token');
		});
		await mockEventDetail(page, 101, makeEvent());

		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'domcontentloaded' });

		await page.waitForURL(/\/login$/, { timeout: 5000 });
		await expect(page).toHaveURL(/\/login$/);
	});

	test('clears auth and redirects to /login when token is expired', async ({ page }) => {
		await page.addInitScript(({ tokenValue, userValue }) => {
			if (location.pathname.startsWith('/bevolunteer')) {
				localStorage.setItem('token', tokenValue);
				localStorage.setItem('user', userValue);
			}
		}, {
			tokenValue: createValidJwtToken(-3600),
			userValue: JSON.stringify({
				id: 1,
				full_name: 'Expired Volunteer',
				email: 'expired@example.com',
				phone: '0900000000',
			}),
		});
		await mockEventDetail(page, 101, makeEvent());

		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'domcontentloaded' });

		await page.waitForURL(/\/login$/, { timeout: 5000 });
		await expect(page).toHaveURL(/\/login$/);
		expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
		expect(await page.evaluate(() => localStorage.getItem('user'))).toBeNull();
	});

	test('shows form title, subtitle, and loading state before event data resolves', async ({ page }) => {
		await setAuthState(page, {
			id: 2,
			full_name: 'Nguyen Van User',
			email: 'user@example.com',
			phone: '0901234567',
		});

		let pendingRoute: any = null;
		await page.route('http://localhost:4000/events/101', (route) => {
			pendingRoute = route;
		});

		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'domcontentloaded' });

		await expect(page.getByRole('heading', { name: /Apply as volunteer/i })).toBeVisible();
		await expect(page.getByText(/Fill in the information below to support the event/i)).toBeVisible();
		await expect(page.getByLabel(/Event name/i)).toHaveValue('');
		await expect(page.getByRole('button', { name: /Loading event/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Loading event/i })).toBeDisabled();

		await pendingRoute.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(makeEvent()),
		});

		await expect(page.getByLabel(/Event name/i)).toHaveValue('Community Cleanup Day');
	});

	test('auto-fills user fields from localStorage and keeps them readOnly', async ({ page }) => {
		await setAuthState(page, {
			id: 3,
			full_name: 'Tran Thi Volunteer',
			email: 'tran.thi@example.com',
			phone: '0987654321',
		});
		await mockEventDetail(page, 101, makeEvent());

		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'networkidle' });

		await expect(page.getByLabel(/Event name/i)).toHaveValue('Community Cleanup Day');
		await expect(page.getByLabel(/User name/i)).toHaveValue('Tran Thi Volunteer');
		await expect(page.getByLabel(/^Email$/i)).toHaveValue('tran.thi@example.com');
		await expect(page.getByLabel(/Phone/i)).toHaveValue('0987654321');

		await expect(page.getByLabel(/Event name/i)).toHaveAttribute('readonly', '');
		await expect(page.getByLabel(/User name/i)).toHaveAttribute('readonly', '');
		await expect(page.getByLabel(/^Email$/i)).toHaveAttribute('readonly', '');
		await expect(page.getByLabel(/Phone/i)).toHaveAttribute('readonly', '');
	});

	test('uses name when title is missing', async ({ page }) => {
		await setAuthState(page, {
			id: 4,
			full_name: 'Fallback User',
			email: 'fallback@example.com',
			phone: '0912345678',
		});
		await mockEventDetail(page, 101, makeEvent({ title: '', name: 'Fallback Event Name' }));

		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'networkidle' });

		await expect(page.getByLabel(/Event name/i)).toHaveValue('Fallback Event Name');
	});

	test('disables submit when the event API returns an error', async ({ page }) => {
		await setAuthState(page, {
			id: 5,
			full_name: 'Error User',
			email: 'error@example.com',
			phone: '0901111111',
		});
		await mockEventDetail(page, 101, { error: 'Server error' }, 500);

		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'networkidle' });

		await expect(page.getByText(/Server error|Unable to fetch event data/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /Submit registration/i })).toBeDisabled();
	});

	test('keeps layout usable on small screens without horizontal overflow', async ({ page }) => {
		await setAuthState(page, {
			id: 6,
			full_name: 'Mobile User',
			email: 'mobile@example.com',
			phone: '0902222222',
		});
		await mockEventDetail(page, 101, makeEvent());

		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'networkidle' });

		await expect(page.getByRole('heading', { name: /Apply as Volunteer/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Submit registration/i })).toBeVisible();

		const hasHorizontalOverflow = await page.locator('html').evaluate((el) => {
			const root = el as HTMLHtmlElement;
			return root.scrollWidth > window.innerWidth;
		});

		expect(hasHorizontalOverflow).toBeFalsy();
	});
});

test.describe('BeVolunteerForm submission flow', () => {
	test('happy path submits registration with correct headers and navigates to success', async ({ page }) => {
		const token = createValidJwtToken();
		await setAuthState(page, {
			id: 7,
			full_name: 'Submit User',
			email: 'submit@example.com',
			phone: '0903333333',
		}, token);
		await mockEventDetail(page, 101, makeEvent());

		const submitMock = await mockRegistrationSubmit(page, 101, {
			onRequest: (headers) => {
				expect(headers.authorization).toBe(`Bearer ${token}`);
				expect(headers['content-type']).toContain('application/json');
			},
		});

		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'networkidle' });

		const submitButton = page.getByRole('button', { name: /Submit registration/i });
		await expect(submitButton).toBeVisible();
		await submitButton.click();
        const submitLoading = page.getByRole('button', { name: /Submitting/i });
		await expect(submitLoading).toBeDisabled();
		await expect(page.getByText(/Submitting\.\.\./i)).toBeVisible();
		expect(submitMock.requestCount).toBe(1);

		await submitMock.fulfill();
		await page.waitForURL(/\/registration-success$/, { timeout: 6000 });
		await expect(page).toHaveURL(/\/registration-success$/);
	});

	test('pressing Enter submits the form and still navigates to success', async ({ page }) => {
		const token = createValidJwtToken();
		await setAuthState(page, {
			id: 8,
			full_name: 'Keyboard User',
			email: 'keyboard@example.com',
			phone: '0904444444',
		}, token);
		await mockEventDetail(page, 101, makeEvent());

		const submitMock = await mockRegistrationSubmit(page, 101, {
			onRequest: (headers) => {
				expect(headers.authorization).toBe(`Bearer ${token}`);
			},
		});

		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'networkidle' });

		const submitButton = page.getByRole('button', { name: /Submit registration/i });
		await submitButton.focus();
		await page.keyboard.press('Enter');

		await expect(page.getByText(/Submitting\.\.\./i)).toBeVisible();
		await submitMock.fulfill();
		await page.waitForURL(/\/registration-success$/, { timeout: 6000 });
		await expect(page).toHaveURL(/\/registration-success$/);
	});

	test('locks the submit button while submitting to avoid duplicate requests', async ({ page }) => {
		const token = createValidJwtToken();
		await setAuthState(page, {
			id: 9,
			full_name: 'Duplicate Guard User',
			email: 'duplicate@example.com',
			phone: '0905555555',
		}, token);
		await mockEventDetail(page, 101, makeEvent());

		const submitMock = await mockRegistrationSubmit(page, 101, {
			onRequest: (headers) => {
				expect(headers.authorization).toBe(`Bearer ${token}`);
			},
		});

		await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'networkidle' });

		const submitButton = page.getByRole('button', { name: /Submit registration/i });
		await submitButton.click();
			const submitLoading = page.getByRole('button', { name: /Submitting/i });
			await expect(submitLoading).toBeDisabled();
		await expect(page.getByText(/Submitting\.\.\./i)).toBeVisible();
			await expect.poll(() => submitMock.requestCount).toBe(1);

		await page.keyboard.press('Enter');
		await page.keyboard.press('Enter');

			await expect.poll(() => submitMock.requestCount).toBe(1);

		await submitMock.fulfill();
		await page.waitForURL(/\/registration-success$/, { timeout: 6000 });
		await expect(page).toHaveURL(/\/registration-success$/);
	});
});