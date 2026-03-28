import fs from "fs";
import path from "path";
import os from "os";

const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");

const readSettings = (): Record<string, any> => {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch {
    throw new Error(`Could not parse ${SETTINGS_PATH}`);
  }
};

const writeSettings = (settings: Record<string, any>): void => {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
};

export const installProxy = (port = 3456): void => {
  const proxyUrl = `http://127.0.0.1:${port}`;
  const settings = readSettings();

  if (!settings.env) settings.env = {};

  if (settings.env.ANTHROPIC_BASE_URL === proxyUrl) {
    console.log("Already installed — Claude Code is already routing through ninjaproxy");
    return;
  }

  // Back up any existing value
  if (settings.env.ANTHROPIC_BASE_URL) {
    settings.env._ANTHROPIC_BASE_URL_BACKUP = settings.env.ANTHROPIC_BASE_URL;
  }

  settings.env.ANTHROPIC_BASE_URL = proxyUrl;
  writeSettings(settings);
  console.log(`Claude Code will now route API calls through ninjaproxy (${proxyUrl})`);
};

export const uninstallProxy = (): void => {
  const settings = readSettings();

  if (!settings.env?.ANTHROPIC_BASE_URL) {
    console.log("ninjaproxy is not installed in Claude Code settings");
    return;
  }

  // Restore backup if one exists
  if (settings.env._ANTHROPIC_BASE_URL_BACKUP) {
    settings.env.ANTHROPIC_BASE_URL = settings.env._ANTHROPIC_BASE_URL_BACKUP;
    delete settings.env._ANTHROPIC_BASE_URL_BACKUP;
  } else {
    delete settings.env.ANTHROPIC_BASE_URL;
  }

  if (Object.keys(settings.env).length === 0) {
    delete settings.env;
  }

  writeSettings(settings);
  console.log("ninjaproxy removed from Claude Code settings");
};
