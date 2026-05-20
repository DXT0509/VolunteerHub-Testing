import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
	FlakyLogicalTestResult,
	FlakyReportDocument,
	FlakyStatus,
	FlakyIterationResult,
} from './flakyReportTypes';

export interface FlakyReportOutput {
	outputDir: string;
	reportJsonPath: string;
	htmlPath: string;
}

export interface FlakyReportGeneratorOptions {
	outputDir?: string;
	reportFileName?: string;
	reportTitle?: string;
}

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'playwright-flaky-report');

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function safeJson(value: unknown) {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}

function toFileHref(filePath: string) {
	return pathToFileURL(filePath).toString();
}

function formatLocation(filePath: string, line?: number, column?: number) {
	if (!line || !column) {
		return filePath;
	}

	return `${filePath}:${line}:${column}`;
}

function renderRun(run: FlakyIterationResult) {
	const locationText = run.error?.location
		? formatLocation(run.error.location.file, run.error.location.line, run.error.location.column)
		: 'Unknown';
	const screenshotMarkup = run.screenshotPath
		? `<a href="${escapeHtml(toFileHref(run.screenshotPath))}" target="_blank" rel="noreferrer">${escapeHtml(run.screenshotPath)}</a>`
		: '<span class="muted">No screenshot</span>';
	const traceMarkup = run.tracePath
		? `<a href="${escapeHtml(toFileHref(run.tracePath))}" target="_blank" rel="noreferrer">${escapeHtml(run.tracePath)}</a>`
		: '<span class="muted">No trace</span>';

	return `
		<details class="run run--${escapeHtml(run.status)}">
			<summary>
				<span>Run ${run.run}</span>
				<strong>${run.status.toUpperCase()}</strong>
				<span>${run.durationMs} ms</span>
			</summary>
			<div class="run__body">
				<div class="kv"><span>Source line</span><code>${escapeHtml(locationText)}</code></div>
				<div class="kv"><span>Screenshot</span><code>${screenshotMarkup}</code></div>
				<div class="kv"><span>Trace</span><code>${traceMarkup}</code></div>
				${run.error ? `
					<div class="error-block">
						<div class="error-block__title">${escapeHtml(run.error.message)}</div>
						${run.error.stack ? `<pre>${escapeHtml(run.error.stack)}</pre>` : ''}
					</div>
				` : ''}
			</div>
		</details>
	`;
}

function renderCard(test: FlakyLogicalTestResult) {
	const statusLabel = test.status.toUpperCase();
	const summaryLabel = `${test.passed}/${test.repeat} passed`;
	const runMarkup = test.runs.map(renderRun).join('');
	const searchText = `${test.title} ${test.file} ${test.projectName}`.toLowerCase();
	const failedRuns = test.runs.filter((run) => run.status === 'failed');

	return `
		<details class="test-card" data-status="${escapeHtml(test.status)}" data-search="${escapeHtml(searchText)}">
			<summary>
				<div class="test-card__head">
					<div>
						<div class="test-card__title">${escapeHtml(test.title)}</div>
						<div class="test-card__meta">${escapeHtml(test.projectName)} • ${escapeHtml(formatLocation(test.file, test.line, test.column))}</div>
					</div>
					<div class="badges">
						<span class="badge badge--${escapeHtml(test.status)}">${escapeHtml(statusLabel)}</span>
						<span class="badge badge--neutral">${escapeHtml(summaryLabel)}</span>
					</div>
				</div>
			</summary>
			<div class="test-card__body">
				<div class="test-card__stats">
					<span>repeat ${test.repeat}</span>
					<span>passed ${test.passed}</span>
					<span>failed ${test.failed}</span>
					<span>failed iterations ${failedRuns.length}</span>
				</div>
				<div class="runs">${runMarkup}</div>
			</div>
		</details>
	`;
}

function renderSection(title: string, status: FlakyStatus, tests: FlakyLogicalTestResult[]) {
	const cards = tests.length > 0
		? tests.map(renderCard).join('')
		: '<div class="empty-state">No tests in this category.</div>';

	return `
		<section class="section" data-status="${escapeHtml(status)}">
			<div class="section__head">
				<h2>${escapeHtml(title)}</h2>
				<div class="section__count">${tests.length} logical tests</div>
			</div>
			<div class="test-list">${cards}</div>
		</section>
	`;
}

function renderTabButton(label: string, status: 'total' | FlakyStatus, count: number, active = false) {
	return `
		<button class="tab${active ? ' tab--active' : ''}" type="button" data-tab="${status}" aria-pressed="${active ? 'true' : 'false'}">
			<span>${escapeHtml(label)}</span>
			<strong>${count}</strong>
		</button>
	`;
}

function renderHtml(document: FlakyReportDocument, reportTitle: string) {
	const passedTests = document.tests.filter((test) => test.status === 'passed').sort((a, b) => a.title.localeCompare(b.title));
	const flakyTests = document.tests.filter((test) => test.status === 'flaky').sort((a, b) => a.title.localeCompare(b.title));
	const failedTests = document.tests.filter((test) => test.status === 'failed').sort((a, b) => a.title.localeCompare(b.title));
	const totalTests = document.tests.length;

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${escapeHtml(reportTitle)}</title>
	<style>
		:root {
			--bg: #0b1020;
			--panel: rgba(11, 16, 32, 0.82);
			--panel-strong: #111833;
			--text: #e8ecff;
			--muted: #9aa6cb;
			--line: rgba(153, 170, 221, 0.18);
			--shadow: 0 18px 42px rgba(0, 0, 0, 0.34);
			--passed: #2dd4bf;
			--flaky: #f59e0b;
			--failed: #fb7185;
			--accent: #7c9cff;
			--sans: 'Segoe UI Variable Text', 'Segoe UI', Inter, Aptos, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
			--mono: 'Cascadia Code', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
			font-family: var(--sans);
		}

		* { box-sizing: border-box; }
		body {
			margin: 0;
			color: var(--text);
			font-family: var(--sans);
			background:
				radial-gradient(circle at top left, rgba(124, 156, 255, 0.18), transparent 30%),
				radial-gradient(circle at top right, rgba(45, 212, 191, 0.14), transparent 24%),
				linear-gradient(180deg, #070a14 0%, #10172a 100%);
			min-height: 100vh;
			-webkit-font-smoothing: antialiased;
			text-rendering: optimizeLegibility;
		}

		.page {
			max-width: 1400px;
			margin: 0 auto;
			padding: 32px 20px 56px;
		}

		.hero, .section, .test-card, .run {
			border: 1px solid var(--line);
			background: var(--panel);
			backdrop-filter: blur(14px);
			box-shadow: var(--shadow);
		}

		.hero {
			padding: 28px;
			border-radius: 28px;
			margin-bottom: 20px;
			background: linear-gradient(135deg, rgba(17, 24, 51, 0.9), rgba(11, 16, 32, 0.82));
		}

		.hero__eyebrow {
			text-transform: uppercase;
			letter-spacing: .18em;
			font-size: .78rem;
			color: var(--muted);
		}

		h1 {
			margin: 10px 0 8px;
			font-size: clamp(2rem, 4vw, 3.6rem);
			line-height: 1.03;
			letter-spacing: -0.04em;
		}

		.hero p {
			max-width: 860px;
			color: var(--muted);
			font-size: 1rem;
			line-height: 1.6;
		}

		.hero__meta {
			display: grid;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 12px;
			margin-top: 22px;
		}

		.hero__meta div {
			padding: 14px 16px;
			background: rgba(255,255,255,.04);
			border: 1px solid rgba(255,255,255,.08);
			border-radius: 18px;
		}

		.hero__meta span {
			display: block;
			font-size: .82rem;
			color: var(--muted);
		}

		.hero__meta strong {
			display: block;
			margin-top: 4px;
			font-size: 1.45rem;
			font-weight: 700;
			font-variant-numeric: tabular-nums;
		}

		.tabs {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 12px;
			margin: 18px 0 22px;
		}

		.tab {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding: 14px 16px;
			border-radius: 18px;
			border: 1px solid var(--line);
			background: rgba(255,255,255,.04);
			color: var(--text);
			cursor: pointer;
			font: inherit;
			font-weight: 650;
			transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
		}

		.tab span {
			text-transform: uppercase;
			letter-spacing: .12em;
			font-size: .78rem;
			color: var(--muted);
		}

		.tab strong {
			font-size: 1.2rem;
			font-variant-numeric: tabular-nums;
		}

		.tab:hover {
			transform: translateY(-1px);
			border-color: rgba(124, 156, 255, 0.35);
		}

		.tab--active {
			background: linear-gradient(135deg, rgba(124, 156, 255, 0.22), rgba(45, 212, 191, 0.10));
			border-color: rgba(124, 156, 255, 0.48);
			box-shadow: 0 12px 32px rgba(124, 156, 255, 0.12);
		}

		.sections {
			display: grid;
			gap: 18px;
		}

		.section {
			padding: 20px;
			border-radius: 22px;
			background: rgba(8, 12, 24, 0.6);
		}

		.section__head {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			gap: 12px;
			margin-bottom: 16px;
		}

		.section__head h2 {
			margin: 0;
			font-size: 1.2rem;
		}

		.section__count {
			color: var(--muted);
			font-size: .92rem;
		}

		.test-list {
			display: grid;
			gap: 14px;
		}

		.test-card {
			padding: 0;
			overflow: hidden;
			border-radius: 20px;
			background: rgba(255,255,255,.03);
		}

		.test-card > summary {
			list-style: none;
			cursor: pointer;
			padding: 18px 18px 16px;
		}

		.test-card > summary::-webkit-details-marker,
		.run > summary::-webkit-details-marker {
			display: none;
		}

		.test-card__head {
			display: flex;
			justify-content: space-between;
			gap: 16px;
			align-items: flex-start;
		}

		.test-card__title {
			font-size: 1.02rem;
			font-weight: 700;
			margin-bottom: 4px;
		}

		.test-card__meta {
			color: var(--muted);
			font-size: .92rem;
		}

		.badges {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
			justify-content: flex-end;
		}

		.badge {
			display: inline-flex;
			align-items: center;
			padding: 7px 11px;
			border-radius: 999px;
			font-size: .8rem;
			font-weight: 700;
			letter-spacing: .02em;
			text-transform: uppercase;
		}

		.badge--passed { background: rgba(45, 212, 191, .14); color: var(--passed); }
		.badge--flaky { background: rgba(245, 158, 11, .16); color: var(--flaky); }
		.badge--failed { background: rgba(251, 113, 133, .16); color: var(--failed); }
		.badge--neutral { background: rgba(255, 255, 255, .07); color: var(--muted); text-transform: none; font-weight: 600; }

		.test-card__body {
			padding: 0 18px 18px;
			border-top: 1px solid var(--line);
		}

		.test-card__stats {
			display: flex;
			gap: 10px;
			flex-wrap: wrap;
			padding: 14px 0 16px;
			color: var(--muted);
			font-size: .92rem;
		}

		.runs {
			display: grid;
			gap: 12px;
		}

		.run {
			border: 1px solid var(--line);
			background: rgba(255,255,255,.03);
			overflow: hidden;
			border-radius: 18px;
		}

		.run > summary {
			display: flex;
			justify-content: space-between;
			gap: 12px;
			padding: 12px 14px;
			cursor: pointer;
			font-weight: 600;
		}

		.run__body {
			padding: 0 14px 14px;
			display: grid;
			gap: 12px;
		}

		.kv {
			display: grid;
			gap: 6px;
		}

		.kv span {
			font-size: .8rem;
			color: var(--muted);
			text-transform: uppercase;
			letter-spacing: .08em;
		}

		.kv code, .error-block pre {
			white-space: pre-wrap;
			word-break: break-word;
			margin: 0;
			padding: 12px;
			border-radius: 14px;
			border: 1px solid var(--line);
			background: rgba(0,0,0,.2);
			color: var(--text);
			font-family: var(--mono);
			font-size: .84rem;
			line-height: 1.6;
		}

		.kv a {
			color: var(--accent);
			text-decoration: none;
		}

		.error-block {
			display: grid;
			gap: 8px;
		}

		.error-block__title {
			font-weight: 700;
			color: #ffd9df;
		}

		.muted {
			color: var(--muted);
		}

		.empty-state {
			padding: 22px;
			border: 1px dashed var(--line);
			border-radius: 18px;
			color: var(--muted);
		}

		.report-view[data-active-tab="passed"] .section[data-status="flaky"],
		.report-view[data-active-tab="passed"] .section[data-status="failed"],
		.report-view[data-active-tab="passed"] .section[data-status="passed"] .badge--flaky,
		.report-view[data-active-tab="passed"] .section[data-status="passed"] .badge--failed {
			display: none;
		}

		.report-view[data-active-tab="flaky"] .section[data-status="passed"],
		.report-view[data-active-tab="flaky"] .section[data-status="failed"] {
			display: none;
		}

		.report-view[data-active-tab="failed"] .section[data-status="passed"],
		.report-view[data-active-tab="failed"] .section[data-status="flaky"] {
			display: none;
		}

		.report-view[data-active-tab="total"] .section {
			display: block;
		}

		.report-view[data-active-tab="total"] .section__count::after {
			content: ' '; 
		}

		@media (max-width: 960px) {
			.hero__meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
			.tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
			.test-card__head { flex-direction: column; }
			.badges { justify-content: flex-start; }
			.section__head { flex-direction: column; align-items: flex-start; }
		}

		@media (max-width: 640px) {
			.page { padding-inline: 12px; }
			.hero, .section { border-radius: 20px; }
			.hero__meta { grid-template-columns: 1fr; }
			.tabs { grid-template-columns: 1fr; }
			.tab { width: 100%; }
		}
	</style>
</head>
<body>
	<main class="page">
		<header class="hero">
			<div class="hero__eyebrow">Standalone flaky test report</div>
			<h1>${escapeHtml(reportTitle)}</h1>
			<p>Each logical test runs multiple iterations internally. This report keeps logical counts intact and shows every pass/fail iteration.</p>
			<div class="hero__meta">
				<div><span>Total logical tests</span><strong>${document.totals.total}</strong></div>
				<div><span>Passed</span><strong>${document.totals.passed}</strong></div>
				<div><span>Flaky</span><strong>${document.totals.flaky}</strong></div>
				<div><span>Failed</span><strong>${document.totals.failed}</strong></div>
				<div><span>Raw executions</span><strong>${document.totals.executions}</strong></div>
			</div>
		</header>

		<nav class="tabs" aria-label="Report tabs">
			${renderTabButton('Total', 'total', totalTests, true)}
			${renderTabButton('Passed', 'passed', passedTests.length)}
			${renderTabButton('Flaky', 'flaky', flakyTests.length)}
			${renderTabButton('Failed', 'failed', failedTests.length)}
		</nav>

		<section class="sections report-view" data-active-tab="total" id="reportView">
			${renderSection('Passed tests', 'passed', passedTests)}
			${renderSection('Flaky tests', 'flaky', flakyTests)}
			${renderSection('Failed tests', 'failed', failedTests)}
		</section>
	</main>
	<script type="application/json" id="flaky-report-data">${safeJson(document)}</script>
	<script>
		(() => {
			const reportView = document.getElementById('reportView');
			const tabs = Array.from(document.querySelectorAll('.tab'));
			if (!reportView || tabs.length === 0) return;

			const setActiveTab = (tab) => {
				reportView.dataset.activeTab = tab;
				for (const button of tabs) {
					button.classList.toggle('tab--active', button.dataset.tab === tab);
					button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
				}
			};

			for (const button of tabs) {
				button.addEventListener('click', () => setActiveTab(button.dataset.tab || 'total'));
			}
		})();
	</script>
</body>
</html>`;
}

export async function generateFlakyReport(
	document: FlakyReportDocument,
	options: FlakyReportGeneratorOptions = {}
): Promise<FlakyReportOutput> {
	const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
	const reportFileName = options.reportFileName ?? 'report.json';
	const reportJsonPath = path.join(outputDir, reportFileName);
	const htmlPath = path.join(outputDir, 'index.html');

	await mkdir(outputDir, { recursive: true });
	await writeFile(reportJsonPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
	await writeFile(htmlPath, renderHtml(document, options.reportTitle ?? 'Flaky Test Report'), 'utf8');

	return {
		outputDir,
		reportJsonPath,
		htmlPath,
	};
}
