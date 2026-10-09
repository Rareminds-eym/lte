/** Local-only smoke test; fixture UUIDs are supplied in a JSON file. No remote DB is accepted. */
import { measureCertificates } from './performance';
import { verifyLearnerBrowserJourney } from './browser-journey';
import { verifyInBrowser } from './browser-verify';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { replaceCertificate } from '../../functions/lib/certificates/replacement';
import { checkDistributedRateLimit } from '../../functions/middleware/distributed-rate-limiter';
import { readFile, writeFile } from 'node:fs/promises';
import { recalculateLevelProgress } from '../../functions/api/v1/courses/progressQueries';
import { onRequestGet as list } from '../../functions/api/v1/certificates/index';
import { onRequestGet as detail } from '../../functions/api/v1/certificates/[credentialId]/index';
import { onRequestGet as download } from '../../functions/api/v1/certificates/[credentialId]/download';
import { onRequestGet as verify } from '../../functions/api/v1/public/certificates/[credentialId]';
import { onRequest as internalAuth } from '../../functions/api/v1/internal/certificates/_middleware';
import { onRequestGet as internalList } from '../../functions/api/v1/internal/certificates/index';
import { createServiceQueryGateway } from '../../functions/lib/query-gateway';
import { signServiceToken } from '../../functions/lib/serviceToken';
import { revokeCertificate } from '../../functions/lib/certificates/revocation';
import type { LteEnv, PagesContext } from '../../functions/lib/types';

const database = process.env['SUPABASE_URL'];
if (!database || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname))
  throw new Error('This integration check accepts only a local database');
const fixturePath = process.argv[2];
if (!fixturePath) throw new Error('Provide the local fixture JSON path');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, string>;
const { Miniflare, convertV4MiniflareOptions } = createRequire(
  resolve(process.cwd(), 'package.json')
)('miniflare') as typeof import('miniflare');
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'certificate-local',
        modules: true,
        script:
          'export default { fetch() { return new Response("local certificate bindings") } }',
        compatibilityDate: '2026-06-08',
        r2Buckets: ['STORAGE_BUCKET'],
        kvNamespaces: ['RATE_LIMIT_KV'],
      },
    ],
  })
);
const bucket = await runtime.getR2Bucket('STORAGE_BUCKET');
const kv = await runtime.getKVNamespace('RATE_LIMIT_KV');
try {
const env = {
  ...process.env,
  SKILLPASSPORT_INTERNAL_URL:
    process.env['CERTIFICATE_VERIFY_BROWSER'] === '1'
      ? 'http://localhost:18788'
      : 'http://localhost:8788',
  ...(process.env['CERTIFICATE_VERIFY_BROWSER'] === '1'
    ? { CERTIFICATE_VERIFY_BASE_URL: 'http://localhost:18788/verify' }
    : {}),
  // The local harness injects fixture identity; production middleware is tested separately.
  ASSETS: await runtime.getWorker(),
  SSO_SERVICE: { getJwks: async () => { throw new Error("SSO is outside this LTE-only harness"); } },
  STORAGE_BUCKET: bucket,
  RATE_LIMIT_KV: kv,
} as unknown as LteEnv;
const qb = createServiceQueryGateway(env);
function context(path: string, credentialId = '', owner = fixture['user']): PagesContext {
  return {
    request: new Request(`http://localhost:8789${path}`, {
      headers: { Origin: 'http://localhost:8788', 'CF-Connecting-IP': '127.0.0.1' },
    }),
    env,
    params: { credentialId },
    data: { user: { sub: owner } },
    next: async () => new Response(),
    waitUntil: () => {},
    passThroughOnException: () => {},
  };
}
if (process.env['CERTIFICATE_VERIFY_BROWSER'] === '1') {
  await verifyLearnerBrowserJourney(
    async () => {
      await recalculateLevelProgress(qb, fixture['user']!, fixture['level']!);
      return Response.json({ ok: true });
    },
    async request => {
      const url = new URL(request.url);
      const downloadMatch = url.pathname.match(
        /^\/api\/v1\/certificates\/(LTE-[0-9A-HJKMNP-TV-Z]{16})\/download$/
      );
      if (downloadMatch) {
        return download(context(url.pathname, downloadMatch[1]));
      }
      if (url.pathname === '/api/v1/certificates') {
        return list(context(`${url.pathname}${url.search}`));
      }
      return new Response('Not found', { status: 404 });
    }
  );
} else {
  await recalculateLevelProgress(qb, fixture['user']!, fixture['level']!);
}
const response = await list(context(`/api/v1/certificates?levelId=${fixture['level']}`));
assert.equal(response.status, 200);
const body = (await response.json()) as {
  certificates: Array<{ credentialId: string; status: string; verifyUrl: string }>;
};
assert.equal(body.certificates.length, 1);
const certificate = body.certificates[0]!;
assert.equal(certificate.status, 'issued');
assert.equal(
  (await detail(context('/api/v1/certificates/test', certificate.credentialId, fixture['other'])))
    .status,
  404
);
const pdf = await download(
  context(`/api/v1/certificates/${certificate.credentialId}/download`, certificate.credentialId)
);
assert.equal(pdf.status, 200, await pdf.clone().text());
const bytes = await pdf.arrayBuffer();
assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
await writeFile('/tmp/lte-certificate-integration.pdf', new Uint8Array(bytes));
const cacheAfterFirstDownload = await bucket.list();
assert.equal(
  (await download(context('/api/v1/certificates/download', certificate.credentialId))).status,
  200
);
const stored = await bucket.list();
assert.equal(
  stored.objects.length,
  cacheAfterFirstDownload.objects.length,
  'Cached download should reuse the R2 object'
);
const writes = stored.objects.length;
const verification = await verify(
  context('/api/v1/public/certificates/test', certificate.credentialId)
);
assert.equal(((await verification.json()) as { status: string }).status, 'valid');
// Inspect the actual PDF annotation in LTE-only runs too.
const pdfLink = new TextDecoder('latin1').decode(bytes).match(/\/URI\s*\(([^)]+)\)/)?.[1];
assert.equal(pdfLink, certificate.verifyUrl);
if (process.env['CERTIFICATE_VERIFY_BROWSER'] === '1' && process.env['CERTIFICATE_LTE_ONLY'] !== '1') {
  await verifyInBrowser(pdfLink!, async request => {
    const ctx = context(
      new URL(request.url).pathname,
      new URL(request.url).pathname.split('/').pop()
    );
    ctx.request = request;
    return verify(ctx);
  });
}
const now = Math.floor(Date.now() / 1000);
const token = await signServiceToken(env.SKILLPASSPORT_INTERNAL_SECRET, {
  app: 'skillpassport',
  actions: ['certificates.read'],
  iat: now,
  exp: now + 60,
});
const internal = context(`/api/v1/internal/certificates?userId=${fixture['user']}`);
internal.request = new Request(internal.request, { headers: { Authorization: `Bearer ${token}` } });
internal.next = () => internalList(internal);
const pulled = await internalAuth(internal);
assert.equal(pulled.status, 200);
const pulledBody = (await pulled.json()) as { data: { items: Array<{ credentialId: string }> } };
assert.equal(
  pulledBody.data.items.length,
  2,
  'Completion must issue both course and role certificates'
);
assert(pulledBody.data.items.some(item => item.credentialId === certificate.credentialId));
const row = await qb.read<{ id: string }>(
  { table: 'certificates', operation: 'read', columns: ['id'], filters: ['credential_id'] },
  {
    filters: [{ column: 'credential_id', op: 'eq', value: certificate.credentialId }],
    result: 'single',
  }
);
await assert.rejects(
  qb.update(
    {
      table: 'certificates',
      operation: 'update',
      updateColumns: ['learner_name'],
      filters: ['id'],
      requireFilter: true,
    },
    {
      filters: [{ column: 'id', op: 'eq', value: row.id }],
      data: { learner_name: 'Must be rejected' },
    }
  ),
  error => error instanceof Error && error.message.includes('immutable')
);
await revokeCertificate(qb, {
  certificateId: row.id,
  actorId: fixture['other']!,
  reason: 'Local integration fixture completed',
});
assert.equal(
  (
    (await (
      await verify(context('/api/v1/public/certificates/test', certificate.credentialId))
    ).json()) as { status: string }
  ).status,
  'revoked'
);
assert.equal(
  (await download(context('/api/v1/certificates/download', certificate.credentialId))).status,
  410
);
process.stdout.write(
  JSON.stringify({
    result: 'passed',
    credentialId: certificate.credentialId,
    verifyUrl: certificate.verifyUrl,
    pdfBytes: bytes.byteLength,
    cacheWrites: writes,
    internalItems: pulledBody.data.items.length,
    checks: [
      'completion issuance',
      'owner isolation',
      'PDF render',
      'cache hit',
      'public verification',
      'signed internal pull',
      'database immutability',
      'revocation',
    ],
  }) + '\n'
);

const replacement = await replaceCertificate(qb, {
  certificateId: row.id,
  actorId: fixture['other']!,
  reason: 'Correct local fixture name',
  corrections: { learner_name: 'Corrected Learner' },
});
assert.equal(replacement.supersedes_id, row.id);
assert.equal(replacement.status, 'issued');
assert.equal(
  (
    await replaceCertificate(qb, {
      certificateId: row.id,
      actorId: fixture['other']!,
      reason: 'Retry correction',
      corrections: { learner_name: 'Ignored on retry' },
    })
  ).id,
  replacement.id
);
assert.equal(
  (
    (await (
      await verify(context('/api/v1/public/certificates/test', replacement.credential_id))
    ).json()) as { learnerName: string }
  ).learnerName,
  'Corrected Learner'
);
const rateKey = crypto.randomUUID();
const rateOptions = { namespace: 'local-check', limit: 1, windowSeconds: 60 };
assert.equal((await checkDistributedRateLimit(env.RATE_LIMIT_KV, rateKey, rateOptions)).allowed, true);
assert.equal((await checkDistributedRateLimit(env.RATE_LIMIT_KV, rateKey, rateOptions)).allowed, false);
process.stdout.write('Local workerd R2/KV and replacement checks passed\n');
if (process.argv[3]) {
  const samples = JSON.parse(await readFile(process.argv[3], 'utf8')) as Record<
    string,
    string
  >[];
  if (samples.length) await measureCertificates(qb, env, samples);
}
} finally {
  await runtime.dispose();
}
