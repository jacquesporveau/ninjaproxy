# ninjaproxy

A transparent privacy proxy for Claude Code. Intercepts API calls, detects and aliases PII in your prompts before they reach Anthropic, then restores the original values in Claude's response — all without changing how you use Claude.

## How it works

```
Claude Code → ninjaproxy (localhost:3456) → api.anthropic.com
```

1. **Intercept** — ninjaproxy sits between Claude Code and the Anthropic API via `ANTHROPIC_BASE_URL`
2. **Sanitize** — names, emails, URLs, mentions, and org names in your latest message are replaced with stable aliases (`PERSON_1`, `EMAIL_1`, etc.) before the request is forwarded
3. **Rehydrate** — aliases in Claude's response are swapped back to the originals before Claude Code receives them

The round-trip is fully transparent. You type normally, Claude responds normally, and PII never leaves your machine in plaintext.

## Install

```bash
yarn install
yarn build
node dist/cli.js install
```

`install` does two things:
1. Starts the ninjaproxy daemon via launchd (auto-restarts on crash, starts on login)
2. Sets `ANTHROPIC_BASE_URL=http://127.0.0.1:3456` in `~/.claude/settings.json`

## CLI

```bash
ninjaproxy install     # build, start daemon, configure Claude Code
ninjaproxy uninstall   # stop daemon, remove from Claude Code settings
ninjaproxy start       # start the daemon
ninjaproxy stop        # stop the daemon
ninjaproxy status      # show running state and PID
```

## Verify it's working

```bash
# Health check
curl http://127.0.0.1:3456/health

# Live logs — shows what gets sanitized per request
tail -f ~/.ninjaproxy/proxy.log
```

Each request logs the alias map when PII is detected:

```
[sanitize] PERSON_1=Dennis Marchand, EMAIL_1=dennis@gmail.com
```

## Entity types

| Alias | Matches |
|-------|---------|
| `EMAIL_n` | Email addresses |
| `URL_n` | HTTP/HTTPS URLs |
| `MENTION_n` | @-mentions |
| `ORG_n` | Company names (Inc, LLC, Corp, etc.) |
| `PERSON_n` | Title Case two-word names |

Detection runs only on the latest user message per request. Previous turns in the conversation are not re-scanned.

## Limitations

**Name detection is broad.** The `PERSON` regex matches any Title Case two-word phrase. In conversations that include code, markdown, or structured content, you'll see false positives — section headers, library names, and similar patterns can all fire. Emails and URLs are matched precisely; names are not.

**Only your typed messages are protected.** ninjaproxy sanitizes what you type, not the full context Claude Code sends. Tool results, file contents, and system prompt injections pass through unmodified. If a file you read into the conversation contains a name or email, Anthropic will see it.

**No cross-session memory.** Aliases are assigned fresh each request. A name aliased in a previous Claude Code session won't carry over.

> Detection is intentionally regex-based. A third-party PII detector will replace `src/detect.ts` in a future iteration.

## Project structure

```
src/
  types.ts      — shared types
  detect.ts     — entity detection (regex, span-blocking)
  alias.ts      — alias assignment (stable, per-request counters)
  rewrite.ts    — text replacement and rehydration
  proxy.ts      — HTTP proxy server (port 3456)
  daemon.ts     — launchd daemon manager
  installer.ts  — patches ~/.claude/settings.json
  cli.ts        — CLI entry point
~/.ninjaproxy/
  proxy.log     — daemon stdout/stderr
~/Library/LaunchAgents/
  com.ninjaproxy.daemon.plist
```

## Uninstall

```bash
node dist/cli.js uninstall
```

Stops the daemon, removes the plist, and restores the original `ANTHROPIC_BASE_URL` in `~/.claude/settings.json` (or removes it if there was none).
