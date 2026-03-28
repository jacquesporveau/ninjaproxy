import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const LABEL = "com.ninjaproxy.daemon";
const PLIST_PATH = path.join(
  os.homedir(),
  "Library",
  "LaunchAgents",
  `${LABEL}.plist`
);
const LOG_DIR = path.join(os.homedir(), ".ninjaproxy");
const LOG_FILE = path.join(LOG_DIR, "proxy.log");

const getProxyScriptPath = (): string => {
  const scriptPath = path.resolve(__dirname, "proxy.js");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Proxy script not found at ${scriptPath}. Run yarn build first.`);
  }
  return scriptPath;
};

const getNodePath = (): string => {
  const result = spawnSync("which", ["node"], { encoding: "utf-8" });
  const nodePath = result.stdout.trim();
  if (!nodePath) throw new Error("Could not locate node binary");
  return nodePath;
};

const buildPlist = (nodePath: string, proxyScript: string, port: number, upstream: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${proxyScript}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NINJAPROXY_PORT</key>
    <string>${port}</string>
    <key>NINJAPROXY_UPSTREAM</key>
    <string>${upstream}</string>
  </dict>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_FILE}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_FILE}</string>
</dict>
</plist>`;

export const startDaemon = (port = 3456, upstream = "api.anthropic.com"): void => {
  const nodePath = getNodePath();
  const proxyScript = getProxyScriptPath();

  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(PLIST_PATH), { recursive: true });
  fs.writeFileSync(PLIST_PATH, buildPlist(nodePath, proxyScript, port, upstream), "utf-8");

  if (isDaemonRunning()) {
    // Already loaded — just restart to pick up any changes
    execSync(`launchctl stop ${LABEL}`, { stdio: "ignore" });
    execSync(`launchctl start ${LABEL}`, { stdio: "ignore" });
    console.log("ninjaproxy restarted");
    return;
  }

  execSync(`launchctl load ${PLIST_PATH}`);
  console.log("ninjaproxy started");
};

export const stopDaemon = (): void => {
  if (!fs.existsSync(PLIST_PATH)) {
    console.log("ninjaproxy is not installed");
    return;
  }

  execSync(`launchctl unload ${PLIST_PATH}`, { stdio: "ignore" });
  fs.unlinkSync(PLIST_PATH);
  console.log("ninjaproxy stopped");
};

export const isDaemonRunning = (): boolean => {
  try {
    const result = spawnSync("launchctl", ["list", LABEL], { encoding: "utf-8" });
    return result.status === 0;
  } catch {
    return false;
  }
};

export const getDaemonStatus = (): { running: boolean; pid?: number } => {
  try {
    const result = spawnSync("launchctl", ["list", LABEL], { encoding: "utf-8" });
    if (result.status !== 0) return { running: false };

    // launchctl list output: PID  Status  Label
    const firstLine = result.stdout.split("\n")[1] ?? "";
    const [pidStr] = firstLine.trim().split(/\s+/);
    const pid = parseInt(pidStr, 10);

    return isNaN(pid) ? { running: true } : { running: true, pid };
  } catch {
    return { running: false };
  }
};
