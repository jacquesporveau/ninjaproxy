import fs from "fs";
import path from "path";
import { buildAliasMap } from "./alias";
import { detectEntities } from "./detect";
import { rewriteText } from "./rewrite";
import { SanitizeResult } from "./types";

const OUTPUT_DIR = path.join(process.cwd(), ".ninjaproxy");

const ensureOutputDir = (): void => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
};

export const sanitizeRawText = (text: string): SanitizeResult => {
  const entities = detectEntities(text);
  const aliasMap = buildAliasMap(entities);
  const sanitizedText = rewriteText(text, aliasMap);

  return { sanitizedText, aliasMap };
};

export const saveAliasMap = (aliasMap: SanitizeResult["aliasMap"]): string => {
  ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, "alias-map.json");
  fs.writeFileSync(filePath, JSON.stringify(aliasMap, null, 2), "utf-8");
  return filePath;
};

export const savePromptText = (text: string): string => {
  ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, "prompt.txt");
  fs.writeFileSync(filePath, text, "utf-8");
  return filePath;
};

export const loadAliasMap = (): SanitizeResult["aliasMap"] => {
  const filePath = path.join(OUTPUT_DIR, "alias-map.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`No alias map found. Run sanitize or prompt first.`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};
