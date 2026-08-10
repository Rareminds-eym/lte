import fs from 'node:fs';
import path from 'node:path';

const summaryPath = path.resolve('coverage/coverage-summary.json');
const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;

if (!stepSummaryFile) {
  console.log('Not running in GitHub Actions, skipping step summary.');
  process.exit(0);
}

if (!fs.existsSync(summaryPath)) {
  console.log('coverage/coverage-summary.json not found (tests may have been skipped due to a prior failure), skipping step summary.');
  process.exit(0);
}

try {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const total = summary.total;

  const categories = ['lines', 'statements', 'functions', 'branches'];
  let rows = '';
  categories.forEach((key) => {
    const data = total[key];
    if (!data) return;
    const categoryName = key.charAt(0).toUpperCase() + key.slice(1);
    rows += `| **${categoryName}** | ${data.total} | ${data.covered} | ${data.pct}% |\n`;
  });

  const markdown = `
### 📊 Code Coverage Report

| Category | Total | Covered | Percentage |
| :--- | :---: | :---: | :---: |
${rows}`;

  fs.appendFileSync(stepSummaryFile, markdown, 'utf8');
  console.log('Successfully added coverage report to GITHUB_STEP_SUMMARY.');
} catch (error) {
  console.error('Failed to parse or write coverage summary:', error);
  process.exit(1);
}
