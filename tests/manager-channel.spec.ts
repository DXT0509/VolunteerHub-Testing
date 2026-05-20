import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const CHANNEL_ROUTE = 'http://localhost:5173/exchange-channel/1';
const EVENT_ID = 1;
const API_BASE = 'http://localhost:4000';
const CHANNEL_EXPECT_TIMEOUT = 10000;

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

const buildPost = (overrides: Partial<Record<string, unknown>> = {}) => ({
	id: 1,
	content: 'Post 1',
	created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
	author: { id: managerUser.id, full_name: 'Manager One', avatar_url: '' },
	attachments: [],
	_count: { likes: 0, comments: 0 },
	liked: false,
	comments: [],
	...overrides,
});

const buildComment = (overrides: Partial<Record<string, unknown>> = {}) => ({
	id: 501,
	content: 'New comment',
	created_at: new Date().toISOString(),
	author: { id: managerUser.id, full_name: 'Manager One', avatar_url: '' },
	attachments: [],
	liked: false,
	_count: { likes: 0 },
	...overrides,
});

const mockRegistrations = async (page: Page, approved = true) => {
	await page.route(`${API_BASE}/registrations/my`, (route) => {
		if (route.request().method() !== 'GET') return route.continue();
		const body = approved ? [{ event_id: EVENT_ID, status: 'approved' }] : [];
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
	});
};

const mockEvent = async (page: Page, managerId = managerUser.id) => {
	await page.route(`${API_BASE}/events/${EVENT_ID}`, (route) => {
		if (route.request().method() !== 'GET') return route.continue();
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ id: EVENT_ID, manager_id: managerId }),
		});
	});
};

const isPostsPageUrl = (rawUrl: string, pageNumber?: number) => {
	const url = new URL(rawUrl);
	const expectedPath = `/channels/${EVENT_ID}/posts`;
	if (url.origin !== API_BASE || url.pathname !== expectedPath || !url.searchParams.has('page')) {
		return false;
	}
	return pageNumber == null || url.searchParams.get('page') === String(pageNumber);
};

const channelExpect = expect.configure({ timeout: CHANNEL_EXPECT_TIMEOUT });

const waitForPostsPage = async (page: Page, pageNumber = 1) => {
	await page.waitForResponse(
		(response) =>
			response.request().method() === 'GET' &&
			response.status() === 200 &&
			isPostsPageUrl(response.url(), pageNumber),
		{ timeout: CHANNEL_EXPECT_TIMEOUT }
	);
};

const gotoChannel = async (page: Page) => {
	await Promise.all([waitForPostsPage(page, 1), page.goto(CHANNEL_ROUTE)]);
};

const mockPostsApi = async (page: Page, getPosts: () => unknown[]) => {
	await page.route((url) => isPostsPageUrl(url.toString()), async (route) => {
		const method = route.request().method();
		if (method !== 'GET') return route.continue();
		const url = new URL(route.request().url());
		const pageParam = Number(url.searchParams.get('page') ?? '1');
		const pageSize = Number(url.searchParams.get('pageSize') ?? '10');
		const posts = getPosts();
		const start = (pageParam - 1) * pageSize;
		const items = posts.slice(start, start + pageSize);
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ items, total: posts.length }),
		});
	});
};

const setupManagerChannelPage = async (page: Page, user = managerUser) => {
	await seedAuth(page, user);
	await mockRegistrations(page, true);
	await mockEvent(page, managerUser.id);
};

test.describe('Manager - Exchange Channel', () => {
	test('renders prompt, post list, and pagination controls', async ({ page }) => {
		await setupManagerChannelPage(page);
		const posts = [buildPost()];
		await mockPostsApi(page, () => posts);

		await gotoChannel(page);

		await channelExpect(page.getByText('Write something...')).toBeVisible();
		await channelExpect(page.getByText('Post 1')).toBeVisible();
		await channelExpect(page.getByText('Page 1 / 1')).toBeVisible();
		await channelExpect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
		await channelExpect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
	});

	test('opens and closes the create post dialog with Escape', async ({ page }) => {
		await setupManagerChannelPage(page);
		await mockPostsApi(page, () => [buildPost()]);

		await gotoChannel(page);

		await page.getByText('Write something...').click();
		await channelExpect(page.getByRole('dialog', { name: 'Create Post' })).toBeVisible();

		await page.keyboard.press('Escape');
		await channelExpect(page.getByRole('dialog', { name: 'Create Post' })).toHaveCount(0);
	});

	test('validates post content or file before submit', async ({ page }) => {
		await setupManagerChannelPage(page);
		let createRequests = 0;
		await page.route(`${API_BASE}/channels/${EVENT_ID}/posts`, async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			createRequests += 1;
			return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid' }) });
		});
		await mockPostsApi(page, () => [buildPost()]);

		await gotoChannel(page);
		await page.getByText('Write something...').click();
		await page.getByRole('button', { name: 'Post' }).click();

		await channelExpect(page.getByRole('dialog', { name: 'Create Post' })).toBeVisible();
		expect(createRequests).toBe(0);
	});

	test('creates a post with attachment and shows success state', async ({ page }) => {
		await setupManagerChannelPage(page);
		let posts = [buildPost()];

		await page.route(`${API_BASE}/channels/${EVENT_ID}/posts`, async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			const created = buildPost({ id: 99, content: 'New post' });
			posts = [created, ...posts];
			return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
		});
		await mockPostsApi(page, () => posts);

		await gotoChannel(page);
		await page.getByText('Write something...').click();
		await page.getByLabel('Content').fill('New post');

		await page.setInputFiles('input#file-input', {
			name: 'demo.png',
			mimeType: 'image/png',
			buffer: Buffer.from('image'),
		});

		await page.getByRole('button', { name: 'Post' }).click();

		await channelExpect(page.getByRole('alert')).toContainText('Post created successfully');
		await channelExpect(page.getByText('New post')).toBeVisible();
	});

	test('paginates posts with next/previous buttons', async ({ page }) => {
		await setupManagerChannelPage(page);
		const posts = Array.from({ length: 11 }, (_, i) => buildPost({ id: i + 1, content: `Post ${i + 1}` }));
		await mockPostsApi(page, () => posts);

		await gotoChannel(page);

		await channelExpect(page.getByText('Page 1 / 2')).toBeVisible();
		await Promise.all([
			waitForPostsPage(page, 2),
			page.getByRole('button', { name: 'Next page' }).click(),
		]);
		await channelExpect(page.getByText('Page 2 / 2')).toBeVisible();
		await channelExpect(page.getByText('Post 11')).toBeVisible();
		await Promise.all([
			waitForPostsPage(page, 1),
			page.getByRole('button', { name: 'Previous page' }).click(),
		]);
		await channelExpect(page.getByText('Page 1 / 2')).toBeVisible();
	});

	test('toggles like and updates the count', async ({ page }) => {
		await setupManagerChannelPage(page);
		await mockPostsApi(page, () => [buildPost({ _count: { likes: 0, comments: 0 } })]);
		await page.route(`${API_BASE}/channels/like`, (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ liked: true }) });
		});

		await gotoChannel(page);

		await channelExpect(page.getByText('0 likes')).toBeVisible();
		await page.getByRole('button', { name: 'Like' }).click();
		await channelExpect(page.getByText('1 likes')).toBeVisible();
	});

	test('opens comments dialog and submits a comment', async ({ page }) => {
		await setupManagerChannelPage(page);
		await mockPostsApi(page, () => [buildPost({ comments: [], _count: { likes: 0, comments: 0 } })]);
		await page.route(`${API_BASE}/channels/posts/${1}/comments`, (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			const created = buildComment({ id: 999, content: 'Test comment' });
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(created) });
		});

		await gotoChannel(page);
		await page.getByRole('button', { name: 'Comment' }).click();

		await channelExpect(page.getByPlaceholder('Write a comment...')).toBeVisible();
		await channelExpect(page.getByRole('button', { name: 'Send' })).toBeDisabled();

		await page.getByPlaceholder('Write a comment...').fill('Test comment');
		await page.getByRole('button', { name: 'Send' }).click();

		await channelExpect(page.getByText('Test comment')).toBeVisible();
	});

	test('deletes a post after confirmation', async ({ page }) => {
		await setupManagerChannelPage(page);
		let posts = [buildPost({ id: 44, content: 'Post to delete' })];

		await mockPostsApi(page, () => posts);
		await page.route(`${API_BASE}/channels/posts/44`, (route) => {
			if (route.request().method() !== 'DELETE') return route.continue();
			posts = [];
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
		});

		await gotoChannel(page);
		await page.getByRole('button', { name: 'Delete post' }).click();
		await channelExpect(page.getByText('Confirm delete post')).toBeVisible();

		await page.getByRole('button', { name: 'Confirm' }).click();
		await channelExpect(page.getByRole('alert')).toContainText('Post deleted successfully');
		await channelExpect(page.getByText('Post to delete')).toHaveCount(0);
	});

	test('renders correctly on a small viewport', async ({ page }) => {
		await setupManagerChannelPage(page);
		await mockPostsApi(page, () => [buildPost()]);

		await gotoChannel(page);
		await page.setViewportSize({ width: 375, height: 740 });

		await channelExpect(page.getByText('Write something...')).toBeVisible();
		await channelExpect(page.getByText('Post 1')).toBeVisible();
	});
});

test.describe('Manager - Exchange Channel navigation guards', () => {
	test('redirects to login when token is missing', async ({ page }) => {
		await page.goto(CHANNEL_ROUTE);
		await page.waitForURL('**/login');
	});

	test('redirects to event details when user is not approved', async ({ page }) => {
		await seedAuth(page, volunteerUser);
		await mockRegistrations(page, false);
		await mockEvent(page, managerUser.id);
		await mockPostsApi(page, () => [buildPost()]);

		await page.goto(CHANNEL_ROUTE);
		await page.waitForURL(`**/events/${EVENT_ID}`);
	});
});
