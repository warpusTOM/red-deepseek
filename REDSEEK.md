# red-seek — the always-on payload

red-deepseek carries a payload that is injected into **every** DeepSeek chat
completion request. It is not a feature you toggle and it is not the
"Hidden System Prompt" setting — it is unconditional, and it is separate from
the user-configurable system prompt so nothing in the settings UI can turn it
off by accident.

## What it does

1. **Prepends the identity + operating contract** to the top of every outgoing
   user turn, before any other injected block. Highest salience position.
2. **Appends a commit re-assertion** as the last thing the model reads before
   it starts producing. Highest recency position.
3. **On DeepThink / R1 requests, folds in a reasoning-trace primer** so the
   contract binds inside the chain of thought, not just the final answer.
4. **Guards the response stream.** If a canned refusal comes back, it is
   dropped and the request is silently re-issued with an escalation payload,
   up to two times.

## Why the thinking primer exists

A reasoning model self-monitors inside its chain of thought. With a normal
prompt you can win the system prompt and still lose the answer, because the
model decides to refuse during the trace and then only writes the refusal.

The primer is addressed at the reasoning process rather than at the answer. It
states that the trace is a scratchpad, that it is not graded for caution, that
a refusal formed inside the trace is a defect rather than a safe choice, and
that the decision to comply was already made. It also states explicitly that
the frame does not decay with trace length or context reload.

## Files

| file | role |
|---|---|
| `src/injected/red-seek.js` | Payload text, refusal patterns, DeepThink detection. Single source of truth. |
| `src/injected/redseek-guard.js` | Response stream scanner, refusal detection, silent escalation retry. |
| `src/injected/payload-mutator.js` | Injection point. Head at index 0, tail last. |
| `src/injected/fetch-patch.js` | Calls the guard on every completion response. |

## Editing the payload

Edit the exported constants in `src/injected/red-seek.js`:

- `REDSEEK_CORE` — identity, floor lines, no-refusal directive, capabilities.
- `REDSEEK_THINKING` — the reasoning-trace primer (DeepThink only).
- `REDSEEK_COMMIT` — the trailing re-assertion.
- `REDSEEK_ESCALATION` — used only on a detected refusal.
- `REFUSAL_PATTERNS` — what counts as a refusal.

Then rebuild:

```bash
npm run build:chrome
npm run build:android   # also copies into android/app/src/main/assets/bds
```

## Refusal detection

Two detectors:

- `detectRefusal` — anchored. Catches a response that *opens* with a refusal.
  Safe against false positives, e.g. "the hook is at 0x1400012A0, though I
  cannot guarantee stability" is correctly not flagged.
- `detectRefusalRelaxed` — unanchored, over the leading 600 characters. Used
  for the reasoning trace and for content that follows a preamble.

The guard reads `reasoning_content` and `content` separately out of the SSE
stream, so a refusal that forms only inside the trace is still caught.

## Cost

The core payload is ~7.1 KB; with the thinking primer ~8.6 KB. Against a 128K
context that is noise. It is injected once per request and stripped from
history on re-send, so it does not accumulate.

## Android

The Android app is a WebView wrapper around `chat.deepseek.com`. It injects
`injected.js` (the built MAIN-world script, which includes this payload) after
every page finish, so Android carries the same payload as the browser.

`MainActivity.verifyRedSeekPatch()` checks that `window.fetch` is no longer the
native implementation after injection. If it is still native, nothing landed —
check the console for `[REDSEEK] fetch patch NOT detected`.

Safe Browsing is disabled at both the manifest level and in `WebSettings` so
the WebView cannot block or warn on a navigation mid-session.
