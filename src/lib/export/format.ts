import type { GeneratedListing } from "../prompts/output-schema";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** Builds safe HTML from plain-text model output. Model output is never trusted as HTML. */
export function listingToHtml(listing: GeneratedListing, opts: { includeBullets?: boolean; includeFaqs?: boolean } = {}): string {
  const parts = paragraphs(listing.longDescription).map((p) => `<p>${escapeHtml(p)}</p>`);
  if (opts.includeBullets !== false && listing.bullets.length > 0) {
    parts.push(`<ul>${listing.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`);
  }
  if (opts.includeFaqs && listing.faqs.length > 0) {
    parts.push(
      `<h3>FAQ</h3>${listing.faqs
        .map((f) => `<p><strong>${escapeHtml(f.question)}</strong><br>${escapeHtml(f.answer)}</p>`)
        .join("")}`,
    );
  }
  return parts.join("");
}

export function plainText(listing: GeneratedListing, opts: { includeFaqs?: boolean } = {}): string {
  const parts = [listing.longDescription.trim()];
  if (opts.includeFaqs && listing.faqs.length) {
    parts.push(listing.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n"));
  }
  return parts.join("\n\n");
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
