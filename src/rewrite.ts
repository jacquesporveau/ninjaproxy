import { AliasEntry } from "./types";

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Sort by longest original first so replacements don't step on each other
export const rewriteText = (
  text: string,
  aliasMap: Record<string, AliasEntry>
): string => {
  let output = text;

  const entries = Object.values(aliasMap).sort(
    (a, b) => b.original.length - a.original.length
  );

  for (const entry of entries) {
    const pattern = new RegExp(escapeRegExp(entry.original), "g");
    output = output.replace(pattern, entry.alias);
  }

  return output;
};

export const rehydrateText = (
  text: string,
  aliasMap: Record<string, AliasEntry>
): string => {
  let output = text;

  const entries = Object.values(aliasMap).sort(
    (a, b) => b.alias.length - a.alias.length
  );

  for (const entry of entries) {
    const pattern = new RegExp(escapeRegExp(entry.alias), "g");
    output = output.replace(pattern, entry.original);
  }

  return output;
};
