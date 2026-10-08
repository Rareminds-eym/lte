import type { CertificateRow } from "./types";
export const CERTIFICATE_TEMPLATE_VERSION = 1;
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}
export function verifyUrl(base: string, credentialId: string): string {
  const url = new URL(`${base.replace(/\/+$/, "")}/${credentialId}`);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid verification URL");
  return url.toString();
}
export function certificateHtml(row: CertificateRow, baseUrl: string): string {
  const e = escapeHtml;
  const url = verifyUrl(baseUrl, row.credential_id);
  const heading =
    row.certificate_type === "course_completion"
      ? "Certificate of Completion"
      : "Certificate of Role Readiness";
  const date = new Date(row.completion_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${e(heading)}</title><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#faf8f2;color:#183e38;font-family:Georgia,serif}main{position:relative;width:297mm;height:210mm;padding:15mm 22mm;border:5mm solid #183e38;overflow:hidden}.brand{font:700 15pt system-ui;letter-spacing:3px;display:flex;align-items:center;gap:12px}svg{width:30px;height:30px}.eyebrow{font:10pt system-ui;letter-spacing:4px;text-transform:uppercase;margin:12mm 0 3mm}h1{font-size:27pt;font-weight:400;margin:0 0 7mm}h2{font-size:29pt;line-height:1.15;margin:3mm 0 5mm;overflow-wrap:anywhere}.title{font-size:19pt;margin:3mm 0;overflow-wrap:anywhere}.subtitle{font-size:12pt;margin:2mm 0;overflow-wrap:anywhere}.facts{font:10pt system-ui;margin-top:5mm}.footer{position:absolute;bottom:12mm;left:22mm;right:22mm;border-top:1px solid #b3a173;padding-top:4mm;font:9pt system-ui;line-height:1.8}a{color:#183e38}.credential{letter-spacing:2px}.award{float:right;font-size:22pt;color:#9a793e}
</style></head><body><main><div class="brand"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#183e38" d="M2 4h13a9 9 0 0 1 5 17l9 9H18L9 20v10H2zm7 7v3h6a2 2 0 0 0 0-3z"/></svg>RAREMINDS <span>LTE</span></div><p class="eyebrow">Learning • Achievement • Progress</p><h1>${e(heading)}</h1><p>This certifies that</p><h2>${e(row.learner_name)}</h2><p>has successfully completed</p><div class="title">${e(row.title)}</div><p class="subtitle">${e(row.subtitle)}</p><p class="facts">${e([row.level_label, row.badge].filter(Boolean).join(" · "))}</p><p class="facts">Completed on ${e(date)}</p><footer class="footer"><span class="award" aria-hidden="true">✧</span><div class="credential">${e(row.credential_id)}</div><a href="${e(url)}">Verify at ${e(url)}</a></footer></main></body></html>`;
}
