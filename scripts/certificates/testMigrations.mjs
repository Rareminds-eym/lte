/** Schema-only local copy. Never resets or migrates the source database. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const database = `lte_certificate_audit_${randomUUID().replaceAll('-', '')}`;
if (!/^lte_certificate_audit_[a-f0-9]{32}$/.test(database)) throw new Error('Invalid scratch database name');
const docker = ['--host', 'unix:///var/run/docker.sock', 'exec', '-i', 'supabase_db_lte'];
const sql = (input, target = database) => execFileSync('docker', [
  ...docker, 'psql', '-X', '-q', '-A', '-t', '-U', 'supabase_admin', '-d', target, '-v', 'ON_ERROR_STOP=1',
], { input, maxBuffer: 64 * 1024 * 1024 });
const exists = query => sql(`${query};`).toString().trim() === 't';
let created = false;
try {
  sql(`CREATE DATABASE ${database} TEMPLATE template0;`, 'postgres');
  created = true;
  const schema = execFileSync('docker', [
    ...docker, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--schema-only', '--no-owner',
  ], { maxBuffer: 64 * 1024 * 1024 });
  sql(schema);
  const migrations = [
    ['20261008100000_create_certificates.sql', "SELECT to_regclass('public.certificates') IS NOT NULL"],
    ['20261008100100_grant_certificates_access.sql', null],
    ['20261008100200_add_certificate_earned_xp_event.sql', null],
    ['20261008100300_certificate_replacements.sql', "SELECT to_regprocedure('public.replace_certificate(uuid,uuid,text,text,jsonb)') IS NOT NULL"],
    ['20261008100400_atomic_certificate_issuance.sql', "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='issue_certificate_atomic')"],
    ['20261008100500_certificate_storage_cleanup.sql', "SELECT to_regclass('public.certificate_storage_cleanup') IS NOT NULL"],
  ];
  for (const [file, check] of migrations) {
    if (!check || !exists(check)) sql(readFileSync(resolve(project, 'supabase/migrations', file)));
  }
  sql(readFileSync(resolve(project, 'supabase/tests/certificates.sql')));
  sql(readFileSync(resolve(project, 'supabase/tests/certificateAtomicStorage.sql')));
  process.stdout.write('Certificate migrations, atomicity, cleanup leases, erasure and grants: passed in isolated local schema.\n');
} finally {
  if (created) {
    sql(`DROP DATABASE ${database} WITH (FORCE);`, 'postgres');
    process.stdout.write('Removed the temporary audit database; the source database was unchanged.\n');
  }
}
