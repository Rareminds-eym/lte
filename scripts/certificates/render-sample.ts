/** Run via npm run certificates:sample. Reads local .dev.vars through Node --env-file. */
import { writeFile } from 'node:fs/promises';
import { renderPdf } from '../../functions/lib/certificates/pdf-renderer';
import { certificateHtml } from '../../functions/lib/certificates/template';
import type { CertificateRow } from '../../functions/lib/certificates/types';

const row: CertificateRow = {
  id: '44444444-4444-4444-8444-444444444444',
  credential_id: 'LTE-0123456789ABCDEF',
  user_id: '11111111-1111-4111-8111-111111111111',
  certificate_type: 'course_completion',
  status: 'issued',
  level_id: '22222222-2222-4222-8222-222222222222',
  role_id: null,
  learning_path_id: null,
  level_progress_id: null,
  learner_name: 'Sample Learner',
  title: 'Applied Problem Solving',
  subtitle: 'Engineering foundations',
  level_label: 'Level 1',
  badge: 'skilled',
  completion_date: '2026-10-08T00:00:00.000Z',
  issued_at: '2026-10-08T00:00:00.000Z',
  metadata: {},
  pdf_object_key: null,
  pdf_template_version: null,
  pdf_generated_at: null,
  revoked_at: null,
  revoked_reason: null,
  revoked_by: null,
  created_at: '2026-10-08T00:00:00.000Z',
  updated_at: '2026-10-08T00:00:00.000Z',
};
const baseUrl = process.env['CERTIFICATE_VERIFY_BASE_URL'];
if (!baseUrl) throw new Error('Set CERTIFICATE_VERIFY_BASE_URL in .dev.vars');
const html = certificateHtml(row, baseUrl);
const output = process.argv[2] ?? '/tmp/lte-certificate-sample.pdf';
try {
  const pdf = await renderPdf(
    {
      CF_ACCOUNT_ID: process.env['CF_ACCOUNT_ID'],
      BROWSER_RENDERING_API_TOKEN: process.env['BROWSER_RENDERING_API_TOKEN'],
    },
    html
  );
  await writeFile(output, new Uint8Array(pdf));
  await writeFile(output.replace(/\.pdf$/, '.html'), html);
  process.stdout.write(
    `Sample PDF saved: ${output} (${pdf.byteLength} bytes)\nThis sample ID is not issued in the database.\n`
  );
} catch (error) {
  // Typed renderer errors contain neither API tokens nor upstream response bodies.
  process.stderr.write(`${error instanceof Error ? error.message : 'PDF rendering failed'}\n`);
  process.exitCode = 1;
}
