#!/usr/bin/env node

import fs from "fs";
import { Command } from "commander";
import {
  loadAliasMap,
  sanitizeRawText,
  saveAliasMap,
  savePromptText,
} from "./sanitize";
import { rehydrateText } from "./rewrite";

const readInput = (filePath: string): string => {
  if (filePath === "-") {
    return fs.readFileSync("/dev/stdin", "utf-8");
  }
  return fs.readFileSync(filePath, "utf-8");
};

const die = (err: unknown): never => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
};

const program = new Command();

program
  .name("ninjaproxy")
  .description("Sanitize text into stable aliases for safe Claude prompting")
  .version("0.1.0");

program
  .command("sanitize")
  .description("Detect entities and replace with aliases")
  .argument("<file>", "Path to input text file (or - for stdin)")
  .action((file: string) => {
    try {
      const text = readInput(file);
      const result = sanitizeRawText(text);
      saveAliasMap(result.aliasMap);

      console.log(result.sanitizedText);
    } catch (err) {
      die(err);
    }
  });

program
  .command("prompt")
  .description("Output a Claude-ready sanitized prompt")
  .argument("<file>", "Path to input text file (or - for stdin)")
  .action((file: string) => {
    try {
      const text = readInput(file);
      const result = sanitizeRawText(text);
      saveAliasMap(result.aliasMap);

      const prompt = [
        "You are analyzing an internal discussion.",
        "All entities have been pseudonymized intentionally.",
        "",
        result.sanitizedText,
      ].join("\n");

      const promptPath = savePromptText(prompt);

      console.log(prompt);
      console.error(`\n[Saved to: ${promptPath}]`);
    } catch (err) {
      die(err);
    }
  });

program
  .command("rehydrate")
  .description("Restore original values using the saved alias map")
  .argument("<file>", "Path to file containing aliased text (or - for stdin)")
  .action((file: string) => {
    try {
      const aliasMap = loadAliasMap();
      const text = readInput(file);
      const restored = rehydrateText(text, aliasMap);
      console.log(restored);
    } catch (err) {
      die(err);
    }
  });

program.parse();
