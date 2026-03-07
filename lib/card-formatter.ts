import type { Passage } from "@/lib/types";

export interface DebateCard {
  shortCite: string;
  fullCite: string;
  tag: string;
  passage: string;
}

function extractYear(dateStr: string | null): string {
  if (dateStr) {
    const match = dateStr.match(/\b(\d{4})\b/);
    if (match) return match[1].slice(-2);
  }
  return new Date().getFullYear().toString().slice(-2);
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function buildDebateCard(passage: Passage, tag: string): DebateCard {
  const yearShort = extractYear(passage.published_date);

  const shortCite = passage.source_author
    ? `${passage.source_author.trim().split(/\s+/).pop()} ${yearShort}`
    : `${extractHostname(passage.source_url)} ${yearShort}`;

  const authorPart = passage.source_author ? `${passage.source_author}, ` : "";
  const datePart = passage.published_date ? `${passage.published_date}, ` : "";
  const fullCite = `(${authorPart}${datePart}"${passage.source_title}", ${passage.source_url})`;

  return {
    shortCite,
    fullCite,
    tag,
    passage: passage.content,
  };
}

export function formatCardAsText(card: DebateCard): string {
  return [
    card.shortCite,
    card.fullCite,
    "",
    `[TAG: ${card.tag}]`,
    "",
    card.passage,
  ].join("\n");
}
