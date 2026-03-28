# ninjaproxy

A CLI tool that detects PII and sensitive entities in text, replaces them with stable aliases, and outputs Claude-ready prompts. Built as a stepping stone toward a Claude Code hook that sanitizes prompts in-flight.

## How it works

1. **Sanitize** — detect entities (emails, URLs, mentions, names, orgs) and replace them with stable aliases (`PERSON_1`, `EMAIL_2`, etc.)
2. **Send** — paste the sanitized output into Claude
3. **Rehydrate** — restore original values from Claude's response

The alias map is persisted to `.ninjaproxy/alias-map.json` between steps 1 and 3.

## Install

```bash
yarn install
```

## Usage

### `sanitize`

Detect and replace entities in a file. Prints sanitized text to stdout, saves alias map silently.

```bash
yarn sanitize <file>
yarn sanitize -        # stdin
pbpaste | yarn sanitize -
```

### `prompt`

Same as sanitize but wraps the output in a Claude-ready system prompt.

```bash
yarn prompt <file>
yarn prompt -          # stdin
pbpaste | yarn prompt -
```

### `rehydrate`

Restore aliases in a response using the saved alias map.

```bash
yarn rehydrate <file>
yarn rehydrate -       # stdin
pbpaste | yarn rehydrate -
```

## Demo

```bash
bash demo.sh
```

## Real-world workflow

```bash
# Copy a Slack thread, sanitize it, and send to Claude
pbpaste | yarn prompt - | pbcopy

# Paste Claude's response, rehydrate it back
pbpaste | yarn rehydrate -
```

## Entity types

| Alias | Matches |
|-------|---------|
| `EMAIL_n` | Email addresses |
| `URL_n` | HTTP/HTTPS URLs |
| `MENTION_n` | @-mentions |
| `ORG_n` | Company names (Inc, LLC, Corp, etc.) |
| `PERSON_n` | Title Case two-word names |

> Detection is intentionally naive regex-based. A third-party PII detector will replace `src/detect.ts` in a future iteration.

## Project structure

```
src/
  types.ts      — shared types
  detect.ts     — entity detection (swap this out for a real PII detector)
  alias.ts      — alias assignment
  rewrite.ts    — text replacement and rehydration
  sanitize.ts   — orchestration + file I/O
  cli.ts        — CLI entry point
.ninjaproxy/
  alias-map.json  — persisted alias map (gitignored)
  prompt.txt      — last prompt output (gitignored)
```

## Build

```bash
yarn build        # compile to dist/
node dist/cli.js sanitize example.txt
```
