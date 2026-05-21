import { test as baseTest, type APIRequestContext, type Browser, type Page, type Playwright, type TestInfo } from '@playwright/test';
import { extractErrorDetails, extractLocationFromStack, type FlakyIterationResult, type FlakySummary } from './flakyReportTypes';

export interface FlakyTestOptions {
	repeat?: number;
}

type FixtureArgs = Parameters<typeof baseTest>[1] extends (
	fixtures: infer T,
	testInfo: TestInfo
) => unknown
	? T
	: never;

type TestCallback = Parameters<typeof baseTest>[1];

const DEFAULT_REPEAT = Number.parseInt(process.env.FLAKY_REPEAT_COUNT ?? '5', 10) || 5;

function captureDefinitionLocation() {
	const stack = new Error().stack;
	if (!stack) {
		return undefined;
	}

	const filteredStack = stack
		.split(/\r?\n/)
		.filter((line) => !line.includes('tests\\support\\') && !line.includes('tests/support/'))
		.join('\n');

	return extractLocationFromStack(filteredStack);
}

function formatAggregateFailure(title: string, summary: FlakySummary) {
	const lines = [
		`Flaky execution summary for ${title}`,
		`Status: ${summary.status}`,
		`Repeat count: ${summary.repeat}`,
		`Passed runs: ${summary.passed}`,
		`Failed runs: ${summary.failed}`,
	];

	for (const run of summary.runs) {
		if (run.status === 'failed') {
			lines.push(`Run ${run.run}: failed`);
			if (run.error?.message) {
				lines.push(run.error.message);
			}
			if (run.error?.stack) {
				lines.push(run.error.stack);
			}
		}
	}

	return lines.join('\n');
}

function makeSummary(
	results: FlakyIterationResult[],
	projectName: string,
	file: string,
	line: number,
	column: number
): FlakySummary {
	const passed = results.filter((result) => result.status === 'passed').length;
	const failed = results.length - passed;

	return {
		status: failed === 0 ? 'passed' : passed > 0 ? 'flaky' : 'failed',
		projectName,
		file,
		line,
		column,
		repeat: results.length,
		passed,
		failed,
		runs: results,
	};
}

function createFlakyTest(baseRepeat = DEFAULT_REPEAT) {
	const flaky = ((name: string, fn: TestCallback, options: FlakyTestOptions = {}) => {
		const definitionLocation = captureDefinitionLocation();
		baseTest(
			name,
			async (
				{
					page,
					browser: fixtureBrowser,
					request,
					browserName,
					playwright,
				}: {
					page: Page;
					browser?: Browser;
					request: APIRequestContext;
					browserName: string;
					playwright: Playwright;
				},
				testInfo
			) => {
			const repeat = options.repeat ?? baseRepeat;
			const browser = fixtureBrowser ?? page.context().browser();

			if (!browser) {
				throw new Error('Flaky test wrapper requires a browser-backed page fixture.');
			}

			const originalTimeout = testInfo.timeout;
			testInfo.setTimeout(originalTimeout * repeat + 60_000);

			const results: FlakyIterationResult[] = [];
			const contextOptions = { ...(testInfo.project.use as Record<string, unknown>) };
			const seedUrl = page.url();

			for (let run = 1; run <= repeat; run += 1) {
				const context = await browser.newContext(contextOptions);
				const page = await context.newPage();
				const startedAt = Date.now();
				let tracingStarted = false;
				let screenshotPath: string | undefined;
				let tracePath: string | undefined;

				try {
					try {
						if (process.env.FLAKY_TRACE === '1') {
							await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
							tracingStarted = true;
						}
					} catch {
						tracingStarted = false;
					}

					if (seedUrl && seedUrl !== 'about:blank') {
						await page.goto(seedUrl);
					}

					const runFixtures = {
						page,
						context,
						browser,
						request,
						browserName,
						playwright,
					} as FixtureArgs & { page: Page };

					await fn(runFixtures, testInfo);
					if (tracingStarted) {
						await context.tracing.stop();
					}
					results.push({ run, status: 'passed', durationMs: Date.now() - startedAt });
				} catch (error) {
					if (tracingStarted) {
						tracePath = testInfo.outputPath(`run-${run}-trace.zip`);
						try {
							await context.tracing.stop({ path: tracePath });
							await testInfo.attach(`run-${run}-trace`, {
								path: tracePath,
								contentType: 'application/zip',
							});
						} catch {
							// Ignore trace failures so the aggregate result is preserved.
						}
					}

					screenshotPath = testInfo.outputPath(`run-${run}-failure.png`);
					try {
						await page.screenshot({ path: screenshotPath, fullPage: true });
					} catch {
						// Ignore screenshot failures so the aggregate result is preserved.
					}

					results.push({
						run,
						status: 'failed',
						durationMs: Date.now() - startedAt,
						error: extractErrorDetails(error),
						screenshotPath,
						tracePath,
					});
				} finally {
					await context.close();
				}
			}

			const summary = makeSummary(
				results,
				testInfo.project.name,
				definitionLocation?.file ?? testInfo.file,
				definitionLocation?.line ?? testInfo.line,
				definitionLocation?.column ?? testInfo.column
			);
			await testInfo.attach('flaky-summary', {
				body: Buffer.from(JSON.stringify(summary, null, 2)),
				contentType: 'application/json',
			});

			if (summary.status === 'failed') {
				throw new Error(formatAggregateFailure(name, summary));
			}
		}
		);
	}) as typeof baseTest;

	flaky.describe = baseTest.describe;
	flaky.skip = baseTest.skip;
	flaky.fixme = baseTest.fixme;
	flaky.only = baseTest.only;
	flaky.beforeEach = baseTest.beforeEach;
	flaky.afterEach = baseTest.afterEach;
	flaky.beforeAll = baseTest.beforeAll;
	flaky.afterAll = baseTest.afterAll;
	flaky.extend = baseTest.extend;
	flaky.use = baseTest.use;
	flaky.step = baseTest.step;

	return flaky;
}

export const test = createFlakyTest();

export type { FlakySummary };
export { createFlakyTest };
