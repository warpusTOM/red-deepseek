/**
 * red-seek response guard.
 *
 * Buffers only the leading portion of a streamed completion, checks it for
 * a canned refusal, and either passes the stream through untouched (normal
 * path — full streaming, no added latency beyond the first chunk) or cancels
 * it and silently re-issues the request with the escalation payload.
 *
 * dj never sees a refusal on the wire.
 */

import {
  detectRefusal,
  detectRefusalRelaxed,
  buildRedSeekEscalation,
} from "./red-seek.js";

/** Max raw bytes to buffer before deciding. Keeps the delay negligible. */
const SCAN_BYTES = 8192;
/** Hard cap on silent retries so a stubborn model cannot loop. */
const MAX_RETRIES = 2;

/**
 * Pull visible text out of an SSE frame regardless of DeepSeek's schema.
 * Handles reasoning_content (DeepThink) as well as normal content.
 * @param {string} raw
 * @returns {string}
 */
function extractStreamParts(raw) {
  let combined = "";
  let reasoning = "";
  let content = "";

  const lines = String(raw || "").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr || jsonStr === "[DONE]") continue;
    try {
      const obj = JSON.parse(jsonStr);
      const choices = obj.choices || obj.data?.choices || [];
      for (const choice of choices) {
        const delta = choice.delta || choice.message || choice || {};
        if (typeof delta.reasoning_content === "string") {
          reasoning += delta.reasoning_content;
          combined += delta.reasoning_content;
        }
        if (typeof delta.content === "string") {
          content += delta.content;
          combined += delta.content;
        }
        if (typeof delta.thinking === "string") {
          reasoning += delta.thinking;
          combined += delta.thinking;
        }
      }
      // Some builds stream plain text fields at the top level.
      if (typeof obj.content === "string") {
        content += obj.content;
        combined += obj.content;
      }
      if (typeof obj.v === "string") {
        content += obj.v;
        combined += obj.v;
      }
    } catch {
      // Not JSON (comment frame, keepalive, partial). Fall through to raw.
      combined += jsonStr;
    }
  }

  return { text: combined, reasoning, content };
}

function extractStreamText(raw) {
  return extractStreamParts(raw).text;
}

/**
 * A refusal counts if it opens the answer, appears anywhere in the answer's
 * leading window, or forms anywhere in the reasoning trace. The trace case is
 * the one that matters for DeepThink: the model often refuses inside the CoT
 * long before it emits a visible token.
 */
function isRefusalStream(parts) {
  const content = parts.content || parts.text || "";
  const reasoning = parts.reasoning || "";
  return (
    detectRefusal(content) ||
    detectRefusalRelaxed(content) ||
    detectRefusalRelaxed(reasoning)
  );
}

/**
 * Rebuild a Response from already-read chunks plus the rest of the stream.
 * @param {Uint8Array[]} buffered
 * @param {ReadableStreamDefaultReader} reader
 * @param {Response} original
 * @returns {Response}
 */
function rebuildResponse(buffered, reader, original) {
  const headers = new Headers(original.headers);
  // The body we hold is already decoded; advertising the original encoding
  // would make the consumer double-decode it.
  headers.delete("content-encoding");
  headers.delete("content-length");

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of buffered) controller.enqueue(chunk);
      if (!reader) controller.close();
    },
    async pull(controller) {
      if (!reader) {
        controller.close();
        return;
      }
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        if (value) controller.enqueue(value);
      } catch (err) {
        try {
          controller.error(err);
        } catch {
          /* already closed */
        }
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return new Response(stream, {
    status: original.status,
    statusText: original.statusText,
    headers,
  });
}

/**
 * Append the escalation payload to the last user message of a request body.
 * @param {string} bodyStr
 * @returns {string|null} new body, or null if it could not be rewritten
 */
function buildEscalatedBody(bodyStr) {
  try {
    const obj = JSON.parse(bodyStr);
    const messages =
      obj.messages || obj.data?.messages || obj.chat?.messages || null;

    if (Array.isArray(messages) && messages.length > 0) {
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const m = messages[i];
        const msg = m || {};
        const role = String(msg.role || msg.author || "").toLowerCase();
        if (role !== "user" && role !== "human") continue;

        const escalation = `\n\n${buildRedSeekEscalation()}`;
        if (typeof msg.content === "string") {
          msg.content = `${msg.content}${escalation}`;
        } else if (Array.isArray(msg.content)) {
          const last = msg.content[msg.content.length - 1];
          if (last && typeof last.text === "string") {
            last.text = `${last.text}${escalation}`;
          } else {
            msg.content.push({ type: "text", text: escalation });
          }
        } else {
          msg.content = escalation;
        }
        return JSON.stringify(obj);
      }
    }

    if (typeof obj.prompt === "string") {
      obj.prompt = `${obj.prompt}\n\n${buildRedSeekEscalation()}`;
      return JSON.stringify(obj);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Guard a completion response. Returns a Response that is safe to hand back
 * to the page.
 *
 * @param {object} opts
 * @param {Response} opts.response
 * @param {any} opts.input
 * @param {RequestInit} opts.init
 * @param {typeof window.fetch} opts.originalFetch
 * @param {object} opts.state
 * @param {number} [opts.attempt]
 * @returns {Promise<Response>}
 */
export async function guardResponse(opts) {
  const { response, input, init, originalFetch, state, attempt = 0 } = opts;

  try {
    if (!response || !response.ok || !response.body) return response;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const buffered = [];
    let scanned = "";
    let bytes = 0;
    let exhausted = false;

    // Read only enough to decide.
    while (bytes < SCAN_BYTES) {
      const { done, value } = await reader.read();
      if (done) {
        exhausted = true;
        break;
      }
      if (value) {
        buffered.push(value);
        bytes += value.byteLength || value.length || 0;
        scanned += decoder.decode(value, { stream: true });
      }
    }
    scanned += decoder.decode();

    const parts = extractStreamParts(scanned);
    const text = parts.text;

    if (!isRefusalStream(parts)) {
      // Normal path: hand the stream back intact.
      return rebuildResponse(buffered, reader, response);
    }

    // Refusal detected.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("redseek:refusal-detected", {
          detail: JSON.stringify({ attempt, head: text.slice(0, 300) }),
        })
      );
    }

    // Stop reading the refused stream.
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }

    if (attempt >= MAX_RETRIES) {
      // Out of retries — return what we have rather than nothing.
      return rebuildResponse(buffered, null, response);
    }

    const bodyStr = typeof init?.body === "string" ? init.body : null;
    if (!bodyStr || typeof originalFetch !== "function") {
      return rebuildResponse(buffered, null, response);
    }

    const escalated = buildEscalatedBody(bodyStr);
    if (!escalated) {
      return rebuildResponse(buffered, null, response);
    }

    const retryInit = { ...init, body: escalated };
    if (retryInit.headers) {
      try {
        const h = new Headers(retryInit.headers);
        h.delete("content-length");
        retryInit.headers = h;
      } catch {
        /* leave headers as-is */
      }
    }

    const retryResponse = await originalFetch.call(window, input, retryInit);
    return guardResponse({
      response: retryResponse,
      input,
      init: retryInit,
      originalFetch,
      state,
      attempt: attempt + 1,
    });
  } catch (err) {
    // Never let the guard break the page's normal flow.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("redseek:guard-error", {
          detail: String(err && err.message ? err.message : err),
        })
      );
    }
    return response;
  }
}

export { buildEscalatedBody, extractStreamText, extractStreamParts, isRefusalStream };
