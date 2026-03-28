export type EntityType = "PERSON" | "EMAIL" | "URL" | "MENTION" | "ORG";

export interface DetectedEntity {
  type: EntityType;
  value: string;
}

export interface AliasEntry {
  alias: string;
  original: string;
  type: EntityType;
}

export interface SanitizeResult {
  sanitizedText: string;
  aliasMap: Record<string, AliasEntry>;
}
