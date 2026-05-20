import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

type ExpectedArticle = {
	id: string;
	title: string;
	author: string;
	date: string;
	imageUrl: string;
	paragraphSnippets: string[];
};

const ARTICLES: ExpectedArticle[] = [
	{
		id: '1',
		title: 'Optimizing volunteer management with technology.',
		author: 'Volunteer Hub Team',
		date: '20/12/2025',
		imageUrl: 'https://i.pinimg.com/1200x/dc/08/84/dc088443f1868f92e551950be6d1802c.jpg',
		paragraphSnippets: [
			'In modern society, volunteering is becoming an increasingly important part of community development.',
			'Volunteer management systems allow for the storage of complete personal information',
			'Many organizations have successfully adopted online volunteer management applications',
			'In the digital age, optimizing volunteer management through technology has become essential',
		],
	},
	{
		id: '2',
		title: 'Balancing remote work with volunteer work.',
		author: 'Community Insights',
		date: '18/12/2025',
		imageUrl: 'https://images.stockcake.com/public/1/9/7/197e7e58-c543-43c2-980e-4ab7ae1026fa_large/anime-office-teamwork-stockcake.jpg',
		paragraphSnippets: [
			'With the rapid development of digital technology and the increasing popularity of remote work',
			'One of the biggest challenges is time management.',
			'Technology plays a crucial role in supporting the balance of remote work in volunteering.',
			'To maintain balance, organizations also need to establish flexible regulations',
			'Balancing remote work in volunteer activities not only optimizes the effectiveness of each project',
		],
	},
	{
		id: '3',
		title: 'Spreading the spirit of volunteerism in the community.',
		author: 'Points of Light',
		date: '10/12/2025',
		imageUrl: 'https://3.files.edl.io/0b2a/24/01/29/162828-0e29dfbb-09a6-4ef3-8535-b86eae10381e.jpeg',
		paragraphSnippets: [
			'Volunteerism is one of the core values',
			'One important way to spread the spirit of volunteerism is to build a culture of active participation.',
			'Technology also plays a crucial role in spreading the spirit of volunteerism.',
			'Education and awareness campaigns are also crucial.',
			'Spreading the spirit of volunteerism is not just an individual act',
		],
	},
];

async function collectRuntimeErrors(page: Page) {
	const runtimeErrors: string[] = [];
	page.on('pageerror', (err) => runtimeErrors.push(err.message));
	return runtimeErrors;
}

function escapeRegex(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function gotoArticle(page: Page, id: string) {
	await page.goto(`${BASE}/article/${id}`, { waitUntil: 'domcontentloaded' });
	await expect(page.locator('body')).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
	const hasHorizontalOverflow = await page.locator('html').evaluate((el) => {
		const root = el as HTMLHtmlElement;
		return root.scrollWidth > window.innerWidth;
	});
	expect(hasHorizontalOverflow).toBeFalsy();
}

async function expectArticleContent(page: Page, article: ExpectedArticle) {
	await expect(page).toHaveURL(new RegExp(`/article/${article.id}$`));
	await expect(page.getByRole('heading', { level: 1, name: article.title })).toBeVisible();
	await expect(page.getByText(article.author, { exact: true })).toBeVisible();
	await expect(page.getByText(new RegExp(escapeRegex(article.date)))).toBeVisible();

	const image = page.getByRole('img', { name: article.title });
	await expect(image).toBeVisible();
	await expect(image).toHaveAttribute('src', article.imageUrl);

	const paragraphs = page.locator('.space-y-4 p');
	await expect(paragraphs).toHaveCount(article.paragraphSnippets.length);
	for (const snippet of article.paragraphSnippets) {
		await expect(page.getByText(snippet)).toBeVisible();
	}

	const currentYear = new Date().getFullYear();
	await expect(page.getByText(new RegExp(`${currentYear}\\s+${article.author}.*All rights reserved\\.`))).toBeVisible();
}

async function expectArticleUILayout(page: Page, article: ExpectedArticle) {
	const heading = page.getByRole('heading', { level: 1, name: article.title });
	const image = page.getByRole('img', { name: article.title });
	const paragraphs = page.locator('.space-y-4 p');
	const footer = page.getByText(new RegExp(`${new Date().getFullYear()}\\s+${article.author}.*All rights reserved\\.`));

	await expect(heading).toBeVisible();
	await expect(page.getByText(new RegExp(`By\\s+${escapeRegex(article.author)}\\s+\\|\\s+${escapeRegex(article.date)}`))).toBeVisible();
	await expect(image).toBeVisible();
	await expect(paragraphs.first()).toBeVisible();
	await expect(footer).toBeVisible();

	const headingBox = await heading.boundingBox();
	const imageBox = await image.boundingBox();
	const firstParagraphBox = await paragraphs.first().boundingBox();
	const footerBox = await footer.boundingBox();

	expect(headingBox).toBeTruthy();
	expect(imageBox).toBeTruthy();
	expect(firstParagraphBox).toBeTruthy();
	expect(footerBox).toBeTruthy();

	expect(imageBox!.y).toBeGreaterThan(headingBox!.y);
	expect(firstParagraphBox!.y).toBeGreaterThan(imageBox!.y);
	expect(footerBox!.y).toBeGreaterThan(firstParagraphBox!.y);
	expect(imageBox!.width).toBeGreaterThan(0);
	expect(imageBox!.height).toBeGreaterThan(0);

	await expect(page.getByText(/undefined|null|\[object Object\]/i)).toHaveCount(0);
}

test.describe('Article page content by id', () => {
	test('renders article 1 with title, metadata, image, all paragraphs and copyright footer', async ({ page }) => {
		const runtimeErrors = await collectRuntimeErrors(page);

		await gotoArticle(page, '1');
		await expectArticleContent(page, ARTICLES[0]);

		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});

	test('renders article 2 content and does not mix content from article 1 or article 3', async ({ page }) => {
		const runtimeErrors = await collectRuntimeErrors(page);

		await gotoArticle(page, '2');
		await expectArticleContent(page, ARTICLES[1]);
		await expect(page.getByRole('heading', { name: ARTICLES[0].title })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: ARTICLES[2].title })).toHaveCount(0);
		await expect(page.getByText(ARTICLES[0].paragraphSnippets[0])).toHaveCount(0);
		await expect(page.getByText(ARTICLES[2].paragraphSnippets[1])).toHaveCount(0);

		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});

	test('renders article 3 with title, metadata, image and complete content', async ({ page }) => {
		const runtimeErrors = await collectRuntimeErrors(page);

		await gotoArticle(page, '3');
		await expectArticleContent(page, ARTICLES[2]);

		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});
});

test.describe('Article page invalid and missing id behavior', () => {
	for (const invalidId of ['999', '100', 'abc']) {
		test(`falls back to article 1 when id is ${invalidId}`, async ({ page }) => {
			const runtimeErrors = await collectRuntimeErrors(page);

			await gotoArticle(page, invalidId);

			await expect(page.locator('body')).not.toBeEmpty();
			await expect(page.getByRole('heading', { level: 1, name: ARTICLES[0].title })).toBeVisible();
			await expect(page.getByText(ARTICLES[0].author, { exact: true })).toBeVisible();
			await expect(page.getByText(new RegExp(escapeRegex(ARTICLES[0].date)))).toBeVisible();
			await expect(page.getByRole('img', { name: ARTICLES[0].title })).toBeVisible();

			expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
		});
	}

	for (const path of ['/article', '/article/']) {
		test(`handles ${path} without a runtime error or blank page`, async ({ page }) => {
			const runtimeErrors = await collectRuntimeErrors(page);

			await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
			await expect(page.locator('body')).toBeVisible();

			const bodyTextLength = await page.locator('body').evaluate((body) => body.innerText.trim().length);
			expect(bodyTextLength).toBeGreaterThan(0);
			expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
		});
	}
});

test.describe('Article page UI rendering', () => {
	test('renders the article shell in the expected visual order', async ({ page }) => {
		const runtimeErrors = await collectRuntimeErrors(page);

		await gotoArticle(page, '1');
		await expectArticleUILayout(page, ARTICLES[0]);
		await expectNoHorizontalOverflow(page);

		expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
	});
});

test.describe('Article page responsive layout', () => {
	const viewports = [
		{ name: 'desktop 1920x1080', width: 1920, height: 1080 },
		{ name: 'tablet 768x1024', width: 768, height: 1024 },
		{ name: 'mobile 375x812', width: 375, height: 812 },
	];

	for (const viewport of viewports) {
		test(`${viewport.name}: article content remains visible without horizontal overflow`, async ({ page }) => {
			const runtimeErrors = await collectRuntimeErrors(page);
			await page.setViewportSize({ width: viewport.width, height: viewport.height });

			await gotoArticle(page, '1');
			await expectArticleUILayout(page, ARTICLES[0]);
			await expectNoHorizontalOverflow(page);

			const articleContainer = page.locator('.max-w-3xl').first();
			const image = page.getByRole('img', { name: ARTICLES[0].title });
			const footer = page.getByText(new RegExp(`${new Date().getFullYear()}\\s+${ARTICLES[0].author}.*All rights reserved\\.`));

			const containerBox = await articleContainer.boundingBox();
			const imageBox = await image.boundingBox();
			expect(containerBox).toBeTruthy();
			expect(imageBox).toBeTruthy();
			expect(containerBox!.x).toBeGreaterThanOrEqual(0);
			expect(containerBox!.x + containerBox!.width).toBeLessThanOrEqual(viewport.width + 1);
			expect(imageBox!.width).toBeLessThanOrEqual(containerBox!.width + 1);

			await footer.scrollIntoViewIfNeeded();
			await expect(footer).toBeVisible();
			expect(runtimeErrors, `Runtime errors found:\n${runtimeErrors.join('\n')}`).toEqual([]);
		});
	}
});
