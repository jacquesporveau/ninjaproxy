#!/usr/bin/env node

import { Command } from "commander";
import { startDaemon, stopDaemon, getDaemonStatus } from "./daemon";
import { installProxy, uninstallProxy } from "./installer";

const die = (err: unknown): never => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
};

const program = new Command();

program
  .name("ninjaproxy")
  .description("Privacy-first proxy that scrubs PII from prompts before they reach Claude")
  .version("0.1.0");

program
  .command("install")
  .description("Build, start the daemon, and configure Claude Code to route through ninjaproxy")
  .option("-p, --port <number>", "Port for the proxy to listen on", "3456")
  .option("-u, --upstream <host>", "Upstream API host to forward requests to", "api.anthropic.com")
  .action((opts) => {
    try {
      const port = parseInt(opts.port, 10);
      installProxy(port);
      startDaemon(port, opts.upstream);
    } catch (err) {
      die(err);
    }
  });

program
  .command("uninstall")
  .description("Stop the daemon and remove ninjaproxy from Claude Code settings")
  .action(() => {
    try {
      stopDaemon();
      uninstallProxy();
    } catch (err) {
      die(err);
    }
  });

program
  .command("start")
  .description("Start the ninjaproxy daemon")
  .option("-p, --port <number>", "Port for the proxy to listen on", "3456")
  .option("-u, --upstream <host>", "Upstream API host to forward requests to", "api.anthropic.com")
  .action((opts) => {
    try {
      startDaemon(parseInt(opts.port, 10), opts.upstream);
    } catch (err) {
      die(err);
    }
  });

program
  .command("stop")
  .description("Stop the ninjaproxy daemon")
  .action(() => {
    try {
      stopDaemon();
    } catch (err) {
      die(err);
    }
  });

program
  .command("status")
  .description("Show whether ninjaproxy is running")
  .action(() => {
    try {
      const { running, pid } = getDaemonStatus();
      if (running) {
        console.log(`running (pid: ${pid})`);
      } else {
        console.log("stopped");
      }
    } catch (err) {
      die(err);
    }
  });

program.parse();
