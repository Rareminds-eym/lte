import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { onRequestGet as verify } from "../../functions/api/v1/public/certificates/[credentialId]";
import { issueCourseCertificate } from "../../functions/lib/certificates/issuance";
import { internalPage } from "../../functions/lib/certificates/internal";
import { certificateOwnerReadPolicy } from "../../functions/lib/certificates/queries";
import { ensureCertificatesForUser } from "../../functions/lib/certificates/reconcile";
import { certificatePdf } from "../../functions/lib/certificates/storage";
import type { CertificateRow } from "../../functions/lib/certificates/types";
import type { QueryGateway } from "../../functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "../../functions/lib/types";

type Fixture = Record<string, string>;

export async function measureCertificates(
  qb: QueryGateway,
  env: LteEnv,
  fixtures: Fixture[],
) {
  const samples: Record<string, number[]> = {};
  async function time(name: string, operation: () => Promise<unknown>) {
    const start = performance.now();
    await operation();
    (samples[name] ??= []).push(performance.now() - start);
  }

  const rows: CertificateRow[] = [];
  for (const fixture of fixtures) {
    await qb.update(
      {
        table: "user_capability_level_progress",
        operation: "update",
        updateColumns: ["status", "completed_at"],
        filters: ["id"],
        requireFilter: true,
      },
      {
        filters: [{ column: "id", op: "eq", value: fixture["progress"] }],
        data: { status: "completed", completed_at: new Date().toISOString() },
      },
    );
    await time("issuance", () =>
      issueCourseCertificate(
        qb,
        {},
        {
          userId: fixture["user"]!,
          levelId: fixture["level"]!,
          levelProgressId: fixture["progress"]!,
        },
      ),
    );
    const row = await qb.read<CertificateRow>(certificateOwnerReadPolicy, {
      auth: { userId: fixture["user"] },
      result: "single",
    });
    rows.push(row);
    await time("list_reconcile", async () => {
      await ensureCertificatesForUser(qb, {}, row.user_id);
      await qb.read(certificateOwnerReadPolicy, {
        auth: { userId: row.user_id },
        result: "many",
      });
    });
    await time("public_verify", async () => {
      const response = await verify({
        request: new Request(
          `http://localhost/api/v1/public/certificates/${row.credential_id}`,
          { headers: { "CF-Connecting-IP": crypto.randomUUID() } },
        ),
        params: { credentialId: row.credential_id },
        env,
        data: {},
      } as PagesContext);
      assert.equal(response.status, 200);
      await response.arrayBuffer();
    });
  }

  // Keep real rendering sequential and within ten initial downloads.
  for (const row of rows.slice(0, 10)) {
    await time("first_download", async () => {
      const response = await certificatePdf(qb, env, row, crypto.randomUUID());
      await response.arrayBuffer();
    });
    const cached = await qb.read<CertificateRow>(certificateOwnerReadPolicy, {
      auth: { userId: row.user_id },
      result: "single",
    });
    for (let sample = 0; sample < 3; sample++) {
      await time("cached_download", async () => {
        const response = await certificatePdf(qb, env, cached, crypto.randomUUID());
        await response.arrayBuffer();
      });
    }
  }
  for (let sample = 0; sample < 30; sample++) {
    await time("internal_page", () =>
      internalPage(qb, { updatedSince: "2000-01-01T00:00:00Z", limit: 100 }),
    );
  }

  const targets: Record<string, number> = {
    issuance: 150,
    list_reconcile: 300,
    public_verify: 150,
    first_download: 8_000,
    cached_download: 500,
    internal_page: 500,
  };
  const report = Object.entries(samples).map(([operation, values]) => {
    values.sort((left, right) => left - right);
    const p95 = values[Math.ceil(values.length * 0.95) - 1]!;
    return {
      operation,
      samples: values.length,
      p50Ms: Number(values[Math.floor(values.length * 0.5)]!.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      targetMs: targets[operation],
      passed: p95 < targets[operation]!,
    };
  });
  await writeFile(
    "/tmp/lte-certificate-performance.json",
    JSON.stringify(
      {
        environment: "local PostgreSQL + workerd R2/KV; real Cloudflare rendering",
        results: report,
      },
      null,
      2,
    ),
  );
  process.stdout.write(`${JSON.stringify({ performance: report })}\n`);
  assert(
    report.every((item) => item.passed),
    "A local performance target failed; inspect /tmp/lte-certificate-performance.json",
  );
}
