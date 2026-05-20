export type FlakyStatus = 'passed' | 'flaky' | 'failed';

export interface FlakySourceLocation {
	file: string;
	line: number;
	column: number;
}

export interface FlakyErrorDetails {
	message: string;
	stack?: string;
	location?: FlakySourceLocation;
}

export interface FlakyIterationResult {
	run: number;
	status: 'passed' | 'failed';
	durationMs: number;
	error?: FlakyErrorDetails;
	screenshotPath?: string;
	tracePath?: string;
}

export interface FlakySummary {
	status: FlakyStatus;
	projectName: string;
	file: string;
	line: number;
	column: number;
	repeat: number;
	passed: number;
	failed: number;
	runs: FlakyIterationResult[];
}

export interface FlakyLogicalTestResult {
	id: string;
	title: string;
	projectName: string;
	file: string;
	line: number;
	column: number;
	status: FlakyStatus;
	repeat: number;
	passed: number;
	failed: number;
	runs: FlakyIterationResult[];
}

export interface FlakyReportTotals {
	total: number;
	passed: number;
	flaky: number;
	failed: number;
	executions: number;
}

export interface FlakyReportDocument {
	version: 1;
	generatedAt: string;
	outputDir: string;
	totals: FlakyReportTotals;
	tests: FlakyLogicalTestResult[];
}

const STACK_LINE_PATTERN = /(?:\()?(?<file>[A-Za-z]:\\[^():\n]+|\/[^():\n]+):(?<line>\d+):(?<column>\d+)\)?/;

function stripAnsi(value: string) {
	return value
		.replace(/\u001B\[[0-9;]*[A-Za-z]/g, '')
		.replace(/\u009B[0-9;]*[A-Za-z]/g, '');
}

export function extractLocationFromStack(stack: string): FlakySourceLocation | undefined {
	for (const line of stack.split(/\r?\n/)) {
		const match = STACK_LINE_PATTERN.exec(line);
		if (!match?.groups) {
			continue;
		}

		const file = match.groups.file;
		if (!file || file.includes('node:internal') || file.includes('internal/')) {
			continue;
		}

		const lineNumber = Number.parseInt(match.groups.line, 10);
		const columnNumber = Number.parseInt(match.groups.column, 10);
		if (!Number.isFinite(lineNumber) || !Number.isFinite(columnNumber)) {
			continue;
		}

		return {
			file,
			line: lineNumber,
			column: columnNumber,
		};
	}

	return undefined;
}

export function extractErrorDetails(error: unknown): FlakyErrorDetails {
	if (error instanceof Error) {
		const message = stripAnsi(error.message);
		const stack = error.stack ? stripAnsi(error.stack) : undefined;
		return {
			message,
			stack,
			location: stack ? extractLocationFromStack(stack) : undefined,
		};
	}

	return {
		message: stripAnsi(String(error)),
	};
}
