/** Run only against the existing local Supabase Docker stack. Never resets a database. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

if (process.argv.includes('--browser')) process.env.CERTIFICATE_VERIFY_BROWSER = '1';
const directory = dirname(fileURLToPath(import.meta.url));
const project = resolve(directory, '../..');
process.loadEnvFile(join(project, '.dev.vars'));
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.SUPABASE_URL).hostname)) {
  throw new Error('Certificate integration requires a local SUPABASE_URL');
}
// Keep the transient bundle below the project so external browser-test packages
// resolve through this project's node_modules. The directory is always removed.
const temporary = mkdtempSync(join(project, '.certificate-check-'));
const fixture = Object.fromEntries(
  [
    'user',
    'other',
    'capability',
    'level',
    'module',
    'track',
    'role',
    'path',
    'progress',
    'moduleProgress',
  ].map(key => [key, randomUUID()])
);
const performanceFixtures = process.argv.includes('--performance')
  ? Array.from({ length: 30 }, () =>
      Object.fromEntries(Object.keys(fixture).map(key => [key, randomUUID()]))
    )
  : [];
const render = (name, current = fixture) =>
  readFileSync(join(directory, name), 'utf8').replace(
    /\{\{(\w+?)(Short)?\}\}/g,
    (_, key, short) => {
      if (!current[key]) throw new Error(`Unknown fixture key ${key}`);
      return short ? current[key].slice(0, 8) : current[key];
    }
  );
const sql = input =>
  execFileSync(
    'docker',
    [
      '--host',
      'unix:///var/run/docker.sock',
      'exec',
      '-i',
      'supabase_db_lte',
      'psql',
      '-U',
      'supabase_admin',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input, stdio: ['pipe', 'inherit', 'inherit'] }
  );
let inserted = false;
try {
  // Fail before fixture writes if migrations have not been applied locally.
  sql(readFileSync(join(project, 'supabase/tests/certificates.sql'), 'utf8'));
  const bundle = join(temporary, 'integration.mjs');
  execFileSync(
    join(project, 'node_modules/.bin/esbuild'),
    [
      join(directory, 'local-integration.ts'),
      '--bundle',
      '--platform=node',
      '--format=esm',
      '--external:@playwright/test',
      '--external:@axe-core/playwright',
      `--outfile=${bundle}`,
    ],
    { stdio: 'inherit' }
  );
  const fixturePath = join(temporary, 'fixture.json');
  writeFileSync(fixturePath, JSON.stringify(fixture));
  sql(render('fixture.sql'));
  inserted = true;
  for (const sample of performanceFixtures) sql(render('fixture.sql', sample));
  const samplesPath = join(temporary, 'performance.json');
  writeFileSync(samplesPath, JSON.stringify(performanceFixtures));
  execFileSync(process.execPath, [bundle, fixturePath, samplesPath], {
    cwd: project,
    stdio: 'inherit',
  });
} finally {
  if (inserted) {
    sql(render('cleanup.sql'));
    for (const sample of performanceFixtures) sql(render('cleanup.sql', sample));
  }
  rmSync(temporary, { recursive: true, force: true });
}
