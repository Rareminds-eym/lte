import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { certificateHtml, escapeHtml, verifyUrl } from "../template";
import { CERTIFICATE_STYLES } from "../templateStyles";
import { env, row } from "./fixtures";

it("escapes display fields and provides a clickable, escaped verification link", () => {
  expect(escapeHtml(`<script a="&'">`)).toBe("&lt;script a=&quot;&amp;&#39;&quot;&gt;");
  const html = certificateHtml(
    { ...row, learner_name: '<script>alert("x")</script>', subtitle: "A&B" },
    env.CERTIFICATE_VERIFY_BASE_URL,
  );
  expect(html).not.toContain("<script>");
  expect(html).toContain("A&amp;B");
  expect(html).toContain(`href="${env.CERTIFICATE_VERIFY_BASE_URL}/${row.credential_id}"`);
  expect(html).not.toMatch(/(?:src=|url\()["']?https?:/);
  expect(
    certificateHtml(
      { ...row, certificate_type: "role_readiness" },
      env.CERTIFICATE_VERIFY_BASE_URL,
    ),
  ).toContain("Certificate of Role Readiness");
  expect(() => verifyUrl("javascript:alert", row.credential_id)).toThrow();
});
it("uses compiled global Tailwind tokens with fixed paper dimensions and no remote styles", () => {
  expect(CERTIFICATE_STYLES).toContain("--spacing-certificate-width: 297mm");
  expect(CERTIFICATE_STYLES).toContain("--spacing-certificate-height: 210mm");
  expect(CERTIFICATE_STYLES).toContain(".text-brand-800");
  expect(CERTIFICATE_STYLES).not.toContain("@import");
  expect(certificateHtml(row, env.CERTIFICATE_VERIFY_BASE_URL)).not.toContain('style="');
  execFileSync(process.execPath, ["scripts/certificates/templateStyles.mjs", "--check"]);
});
