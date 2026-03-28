#!/usr/bin/env node

import http from "http";
import https from "https";
import { detectEntities } from "./detect";
import { buildAliasMap } from "./alias";
import { rewriteText, rehydrateText } from "./rewrite";
import { AliasEntry } from "./types";

const PORT = parseInt(process.env.NINJAPROXY_PORT ?? "3456", 10);
const ANTHROPIC_HOST = process.env.NINJAPROXY_UPSTREAM ?? "api.anthropic.com";
const { version } = require("../package.json");

// Extract text from a single message's content
const extractText = (msg: any): string => {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text as string)
      .join("\n");
  }
  return "";
};

// Rewrite text content of a single message
const rewriteMessage = (msg: any, aliasMap: Record<string, AliasEntry>): any => {
  if (typeof msg.content === "string") {
    return { ...msg, content: rewriteText(msg.content, aliasMap) };
  }
  if (Array.isArray(msg.content)) {
    return {
      ...msg,
      content: msg.content.map((block: any) =>
        block.type === "text"
          ? { ...block, text: rewriteText(block.text, aliasMap) }
          : block
      ),
    };
  }
  return msg;
};

const sanitizeMessages = (
  messages: any[]
): { messages: any[]; aliasMap: Record<string, AliasEntry> } => {
  const empty = { messages, aliasMap: {} };

  // Only inspect the latest user message — previous turns are already sent
  const lastUserIdx = messages.reduce(
    (last, msg, i) => (msg.role === "user" ? i : last),
    -1
  );
  if (lastUserIdx === -1) return empty;

  const latestText = extractText(messages[lastUserIdx]);
  if (!latestText.trim()) return empty;

  const entities = detectEntities(latestText);
  const aliasMap = buildAliasMap(entities);

  if (Object.keys(aliasMap).length === 0) return empty;

  const summary = Object.entries(aliasMap)
    .map(([alias, entry]) => `${alias}=${entry.original}`)
    .join(", ");
  console.log(`[sanitize] ${summary}`);

  return {
    messages: messages.map((msg, i) =>
      i === lastUserIdx ? rewriteMessage(msg, aliasMap) : msg
    ),
    aliasMap,
  };
};

// Rehydrate a single SSE line in place
const processSSELine = (line: string, aliasMap: Record<string, AliasEntry>): string => {
  if (!line.startsWith("data: ")) return line;
  const data = line.slice(6);
  if (data.trim() === "[DONE]") return line;

  try {
    const event = JSON.parse(data);
    if (event.delta?.type === "text_delta" && event.delta.text) {
      event.delta.text = rehydrateText(event.delta.text, aliasMap);
      return "data: " + JSON.stringify(event);
    }
  } catch {}

  return line;
};

// Rehydrate a full non-streaming response body
const rehydrateResponseBody = (body: string, aliasMap: Record<string, AliasEntry>): string => {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed.content)) {
      parsed.content = parsed.content.map((block: any) =>
        block.type === "text"
          ? { ...block, text: rehydrateText(block.text, aliasMap) }
          : block
      );
    }
    return JSON.stringify(parsed);
  } catch {
    return body;
  }
};

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version }));
    return;
  }

  let body = "";

  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    let sanitizedBody: string;
    let isStreaming = false;
    let aliasMap: Record<string, AliasEntry> = {};

    try {
      const parsed = JSON.parse(body);
      isStreaming = parsed.stream === true;

      if (Array.isArray(parsed.messages)) {
        const result = sanitizeMessages(parsed.messages);
        parsed.messages = result.messages;
        aliasMap = result.aliasMap;
      }

      sanitizedBody = JSON.stringify(parsed);
    } catch {
      sanitizedBody = body;
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers[key] = value;
    }
    headers["host"] = ANTHROPIC_HOST;
    headers["content-length"] = Buffer.byteLength(sanitizedBody).toString();
    // Force uncompressed responses so we can read and rehydrate the body
    delete headers["accept-encoding"];
    // Body is reassembled as a single buffer — chunked framing no longer applies
    delete headers["transfer-encoding"];

    const options: https.RequestOptions = {
      hostname: ANTHROPIC_HOST,
      port: 443,
      path: req.url,
      method: req.method,
      headers,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);

      if (isStreaming) {
        let buffer = "";

        proxyRes.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            res.write(processSSELine(line, aliasMap) + "\n");
          }
        });

        proxyRes.on("end", () => {
          if (buffer) res.write(processSSELine(buffer, aliasMap));
          res.end();
        });
      } else {
        let responseBody = "";

        proxyRes.on("data", (chunk: Buffer) => {
          responseBody += chunk.toString();
        });

        proxyRes.on("end", () => {
          res.end(rehydrateResponseBody(responseBody, aliasMap));
        });
      }
    });

    proxyReq.on("error", (err) => {
      console.error("Proxy error:", err.message);
      if (!res.headersSent) res.writeHead(502);
      res.end(JSON.stringify({ error: "Proxy error", message: err.message }));
    });

    proxyReq.write(sanitizedBody);
    proxyReq.end();
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`ninjaproxy running on http://127.0.0.1:${PORT}`);
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error("Server error:", err.message);
  }
  process.exit(1);
});
