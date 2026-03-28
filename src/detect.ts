import { DetectedEntity, EntityType } from "./types";

type Span = [number, number]; // [start, end) indices into text

const collectSpans = (text: string, regex: RegExp): Span[] => {
  const spans: Span[] = [];
  for (const match of text.matchAll(regex)) {
    spans.push([match.index!, match.index! + match[0].length]);
  }
  return spans;
};

const overlapsAny = (start: number, end: number, blocked: Span[]): boolean =>
  blocked.some(([s, e]) => start < e && end > s);

const collectEntities = (
  text: string,
  regex: RegExp,
  type: EntityType,
  blocked: Span[]
): DetectedEntity[] => {
  const results: DetectedEntity[] = [];
  for (const match of text.matchAll(regex)) {
    const start = match.index!;
    const end = start + match[0].length;
    if (!overlapsAny(start, end, blocked)) {
      results.push({ type, value: match[0] });
    }
  }
  return results;
};

const uniqueEntities = (entities: DetectedEntity[]): DetectedEntity[] => {
  const seen = new Set<string>();
  const output: DetectedEntity[] = [];

  for (const entity of entities) {
    const key = `${entity.type}:::${entity.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(entity);
    }
  }

  return output;
};

export const detectEntities = (text: string): DetectedEntity[] => {
  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const mentionRegex = /@[a-zA-Z0-9._-]+/g;
  // Naive full-name matcher
  const personRegex = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
  // Super-naive org matcher
  const orgRegex =
    /\b[A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*)*\s(?:Inc|Corp|Corporation|LLC|Ltd|Roofing|Technologies|Systems|Company)\b/g;

  // Phase 1: high-confidence anchors — claim their spans first
  const emailSpans = collectSpans(text, emailRegex);
  const urlSpans = collectSpans(text, urlRegex);
  const anchorSpans: Span[] = [...emailSpans, ...urlSpans];

  const entities: DetectedEntity[] = [];

  for (const span of emailSpans) {
    entities.push({ type: "EMAIL", value: text.slice(span[0], span[1]) });
  }
  for (const span of urlSpans) {
    entities.push({ type: "URL", value: text.slice(span[0], span[1]) });
  }

  // Phase 2: secondary patterns — skip anything inside an anchor span
  entities.push(...collectEntities(text, mentionRegex, "MENTION", anchorSpans));

  // Phase 3: structural patterns — also skip anchor spans
  const orgEntities = collectEntities(text, orgRegex, "ORG", anchorSpans);
  entities.push(...orgEntities);

  // Block org spans too so PERSON doesn't re-match org fragments
  const orgSpans = orgEntities.flatMap(({ value }) => {
    const spans: Span[] = [];
    let idx = text.indexOf(value);
    while (idx !== -1) {
      spans.push([idx, idx + value.length]);
      idx = text.indexOf(value, idx + 1);
    }
    return spans;
  });

  const personBlocked: Span[] = [...anchorSpans, ...orgSpans];
  entities.push(...collectEntities(text, personRegex, "PERSON", personBlocked));

  return uniqueEntities(entities);
};
