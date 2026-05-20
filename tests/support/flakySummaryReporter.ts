import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { generateFlakyReport } from './flakyReportGenerator';
import type {
	FlakyLogicalTestResult,
	FlakyReportDocument,
	FlakyStatus,
	FlakySummary,
} from './flakyReportTypes';

interface LogicalResult {
	title: string;
	status: FlakyStatus | 'passed' | 'failed';
	summary?: FlakySummary;
	result?: FlakyLogicalTestResult;
}

function parseSummary(result: TestResult): FlakySummary | undefined {
	const attachment = result.attachments.find((item) => item.name === 'flaky-summary');

	if (!attachment) {
		return undefined;
	}

	const raw = attachment.body ?? (attachment.path ? readFileSync(attachment.path) : undefined);
	if (!raw) {
		return undefined;
	}

	return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)) as FlakySummary;
}

function getTitle(test: TestCase) {
	return test.titlePath().slice(1).join(' > ') || test.title;
}

export default class FlakySummaryReporter implements Reporter {
	private readonly results: LogicalResult[] = [];
	private readonly outputDir = resolve(process.cwd(), process.env.FLAKY_REPORT_DIR ?? 'playwright-flaky-report');
	private readonly reportTitle = process.env.FLAKY_REPORT_TITLE ?? 'Flaky Test Report';

	onTestEnd(test: TestCase, result: TestResult) {
		const summary = parseSummary(result);
		const title = getTitle(test);
		const file = test.location?.file ?? 'unknown';
		const line = test.location?.line ?? 0;
		const column = test.location?.column ?? 0;

		if (summary) {
			this.results.push({
				title,
				status: summary.status,
				summary,
				result: {
					id: test.id,
					title,
					projectName: summary.projectName,
					file: summary.file,
					line: summary.line,
					column: summary.column,
					status: summary.status,
					repeat: summary.repeat,
					passed: summary.passed,
					failed: summary.failed,
					runs: summary.runs,
				},
			});
			return;
		}

		this.results.push({
			title,
			status: result.status === 'passed' ? 'passed' : 'failed',
		});
	}

	async onEnd() {
		if (this.results.length === 0) {
			return;
		}

		const logicalResults = this.results.filter((result) => result.result);
		const totals = logicalResults.reduce(
			(acc, result) => {
				acc.total += 1;
				acc[result.status] += 1;
				acc.executions += result.result?.repeat ?? 0;
				return acc;
			},
			{ total: 0, passed: 0, flaky: 0, failed: 0, executions: 0 }
		);

		const document: FlakyReportDocument = {
			version: 1,
			generatedAt: new Date().toISOString(),
			outputDir: this.outputDir,
			totals,
			tests: logicalResults
				.map((result) => result.result)
				.filter((value): value is NonNullable<typeof value> => Boolean(value)),
		};

		const output = await generateFlakyReport(document, {
			outputDir: this.outputDir,
			reportTitle: this.reportTitle,
		});

		console.log('');
		console.log('Flaky logical test summary');
		console.log(`  total: ${totals.total}`);
		console.log(`  passed: ${totals.passed}`);
		console.log(`  flaky: ${totals.flaky}`);
		console.log(`  failed: ${totals.failed}`);
		console.log(`  raw executions: ${totals.executions}`);
		console.log('');
		console.log(`Standalone report written to ${output.htmlPath}`);
	}
}
