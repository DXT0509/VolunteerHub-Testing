import { test, expect, Page } from '@playwright/test';

const CHANNEL_ROUTE = '/exchange-channel/1';
const EVENT_ID = 1;
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

const buildPost = (overrides: Partial<Record<string, unknown>> = {}) => ({
	id: 1,
	content: 'Bài viết 1',
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
	content: 'Bình luận mới',
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

const mockPostsApi = async (page: Page, getPosts: () => unknown[]) => {
	await page.route(`${API_BASE}/channels/${EVENT_ID}/posts**`, async (route) => {
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

test.describe('Manager - Exchange Channel', () => {
	test.beforeEach(async ({ page }) => {
		await seedAuth(page);
		await mockRegistrations(page, true);
		await mockEvent(page, managerUser.id);
	});

	test('renders prompt, post list, and pagination controls', async ({ page }) => {
		const posts = [buildPost()];
		await mockPostsApi(page, () => posts);

		await page.goto(CHANNEL_ROUTE);

		await expect(page.getByText('Bạn viết gì đi')).toBeVisible();
		await expect(page.getByText('Bài viết 1')).toBeVisible();
		await expect(page.getByText('Trang 1 / 1')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Trang trước' })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
	});

	test('opens and closes the create post dialog with Escape', async ({ page }) => {
		await mockPostsApi(page, () => [buildPost()]);

		await page.goto(CHANNEL_ROUTE);

		await page.getByText('Bạn viết gì đi').click();
		await expect(page.getByRole('heading', { name: 'Tạo bài viết' })).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.getByRole('heading', { name: 'Tạo bài viết' })).toHaveCount(0);
	});

	test('validates post content or file before submit', async ({ page }) => {
		await mockPostsApi(page, () => [buildPost()]);

		await page.goto(CHANNEL_ROUTE);
		await page.getByText('Bạn viết gì đi').click();
		await page.getByRole('button', { name: 'Đăng bài' }).click();

		await expect(page.getByRole('alert')).toContainText('Bài viết phải có nội dung hoặc ít nhất một tệp đính kèm');
	});

	test('creates a post with attachment and shows success state', async ({ page }) => {
		let posts = [buildPost()];

		await page.route(`${API_BASE}/channels/${EVENT_ID}/posts`, async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			const created = buildPost({ id: 99, content: 'Bài viết mới' });
			posts = [created, ...posts];
			return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
		});
		await mockPostsApi(page, () => posts);

		await page.goto(CHANNEL_ROUTE);
		await page.getByText('Bạn viết gì đi').click();
		await page.getByLabel('Nội dung').fill('Bài viết mới');

		await page.setInputFiles('input#file-input', {
			name: 'demo.png',
			mimeType: 'image/png',
			buffer: Buffer.from('image'),
		});

		await page.getByRole('button', { name: 'Đăng bài' }).click();

		await expect(page.getByRole('alert')).toContainText('Đăng bài thành công');
		await expect(page.getByText('Bài viết mới')).toBeVisible();
	});

	test('paginates posts with next/previous buttons', async ({ page }) => {
		const posts = Array.from({ length: 11 }, (_, i) => buildPost({ id: i + 1, content: `Bài viết ${i + 1}` }));
		await mockPostsApi(page, () => posts);

		await page.goto(CHANNEL_ROUTE);

		await expect(page.getByText('Trang 1 / 2')).toBeVisible();
		await page.getByRole('button', { name: 'Trang sau' }).click();
		await expect(page.getByText('Trang 2 / 2')).toBeVisible();
		await expect(page.getByText('Bài viết 11')).toBeVisible();
		await page.getByRole('button', { name: 'Trang trước' }).click();
		await expect(page.getByText('Trang 1 / 2')).toBeVisible();
	});

	test('toggles like and updates the count', async ({ page }) => {
		await mockPostsApi(page, () => [buildPost({ _count: { likes: 0, comments: 0 } })]);
		await page.route(`${API_BASE}/channels/like`, (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ liked: true }) });
		});

		await page.goto(CHANNEL_ROUTE);

		await expect(page.getByText('0 lượt thích')).toBeVisible();
		await page.getByRole('button', { name: 'Thích' }).click();
		await expect(page.getByText('1 lượt thích')).toBeVisible();
	});

	test('opens comments dialog and submits a comment', async ({ page }) => {
		await mockPostsApi(page, () => [buildPost({ comments: [], _count: { likes: 0, comments: 0 } })]);
		await page.route(`${API_BASE}/channels/posts/${1}/comments`, (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			const created = buildComment({ id: 999, content: 'Bình luận test' });
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(created) });
		});

		await page.goto(CHANNEL_ROUTE);
		await page.getByRole('button', { name: 'Bình luận' }).click();

		await expect(page.getByPlaceholder('Viết bình luận...')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Gửi' })).toBeDisabled();

		await page.getByPlaceholder('Viết bình luận...').fill('Bình luận test');
		await page.getByRole('button', { name: 'Gửi' }).click();

		await expect(page.getByRole('alert')).toContainText('Bình luận thành công');
		await expect(page.getByText('Bình luận test')).toBeVisible();
	});

	test('deletes a post after confirmation', async ({ page }) => {
		let posts = [buildPost({ id: 44, content: 'Bài viết cần xóa' })];

		await mockPostsApi(page, () => posts);
		await page.route(`${API_BASE}/channels/posts/44`, (route) => {
			if (route.request().method() !== 'DELETE') return route.continue();
			posts = [];
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
		});

		await page.goto(CHANNEL_ROUTE);
		await page.getByRole('button', { name: 'Xóa bài' }).click();
		await expect(page.getByText('Xác nhận xóa bài viết')).toBeVisible();

		await page.getByRole('button', { name: 'Xác nhận' }).click();
		await expect(page.getByRole('alert')).toContainText('Xóa bài viết thành công');
		await expect(page.getByText('Bài viết cần xóa')).toHaveCount(0);
	});

	test('renders correctly on a small viewport', async ({ page }) => {
		await mockPostsApi(page, () => [buildPost()]);
		await page.setViewportSize({ width: 375, height: 740 });

		await page.goto(CHANNEL_ROUTE);

		await expect(page.getByText('Bạn viết gì đi')).toBeVisible();
		await expect(page.getByText('Bài viết 1')).toBeVisible();
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
