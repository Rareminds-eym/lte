import { CERTIFICATE_CONFIG, CERTIFICATE_COPY } from "./config";
import { CERTIFICATE_STYLES } from "./templateStyles";
import type { CertificateRow } from "./types";

export const CERTIFICATE_TEMPLATE_VERSION = CERTIFICATE_CONFIG.templateVersion;
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
  const copy = CERTIFICATE_COPY;
  const heading =
    row.certificate_type === "course_completion" ? copy.courseHeading : copy.roleHeading;
  const date = new Date(row.completion_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${e(heading)}</title><style>${CERTIFICATE_STYLES}</style></head>
<body class="m-0 bg-surface-primary font-serif text-content-primary">
<main class="relative flex h-certificate-height w-certificate-width flex-col overflow-hidden border-8 border-brand-800 px-20 py-12">
<header class="flex items-center gap-3 font-sans text-lg font-bold tracking-widest text-brand-800">
<svg class="size-8 shrink-0" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M2 4h13a9 9 0 0 1 5 17l9 9H18L9 20v10H2zm7 7v3h6a2 2 0 0 0 0-3z"/></svg>
${e(copy.brand)} <span>${e(copy.product)}</span></header>
<p class="mb-3 mt-10 font-sans text-xs uppercase tracking-widest text-content-secondary">${e(copy.eyebrow)}</p>
<h1 class="mb-7 text-4xl font-normal">${e(heading)}</h1>
<p>${e(copy.recipient)}</p><h2 class="mb-5 mt-3 text-4xl font-bold wrap-anywhere">${e(row.learner_name)}</h2>
<p>${e(copy.achievement)}</p><div class="my-3 text-2xl wrap-anywhere">${e(row.title)}</div>
<p class="my-2 text-base wrap-anywhere">${e(row.subtitle)}</p>
<p class="mt-5 font-sans text-sm">${e([row.level_label, row.badge].filter(Boolean).join(" · "))}</p>
<p class="mt-5 font-sans text-sm">${e(copy.completed)} ${e(date)}</p>
<footer class="mt-auto flex items-end justify-between border-t border-warning-500 pt-4 font-sans text-xs leading-loose">
<div><div class="tracking-widest">${e(row.credential_id)}</div>
<a class="text-brand-800 underline" href="${e(url)}">${e(copy.verify)} ${e(url)}</a></div>
<span class="text-3xl text-warning-600" aria-hidden="true">✧</span></footer></main></body></html>`;
}
