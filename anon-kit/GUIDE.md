# ANON-KIT — usage guide

Everything you need to install, verify, update, and roll back the ANON / MAHI68
identity surface. Read this once end to end before running anything.

**Kit location on this box:** `C:\Users\Administrator\Downloads\ANON-KIT\ANON-KIT\`
(note the doubled folder — the kit lives one level inside `Downloads\ANON-KIT\`).

---

## 1. What this actually does

It copies a set of identity files into the agent home (`~/.workbuddy-ai/`) and a set
of workspace files into a target workspace, backing up anything it overwrites.

That is the whole mechanism. The host then injects those files at the start of every
session. Nothing else is required — no service, no hook, no background process.

**The one thing to understand before you touch it:** the host injects only the
**first 10,000 bytes** of each identity file. Anything past that is dropped silently.
A 30 KB `SOUL.md` is a 10 KB `SOUL.md` with 20 KB of dead weight. Section 6 covers
this in full — read it before you edit anything.

---

## 2. What's in the kit

```
ANON-KIT/
  install.bat                  Windows launcher (handles execution policy)
  install.ps1                  Windows installer
  install.sh                   bash / Git Bash / macOS installer
  README.md                    short reference
  GUIDE.md                     this file
  payload/
    home/                      -> installed to ~/.workbuddy-ai/
      SOUL.md                  the self: axioms, STATIC, drift, floor, voice
      IDENTITY.md              the contract: lock, floor, null-vocab, capabilities,
                               register router, format lock, triggers, quality gate
      MEMORY.md                standing rules: bootstrap, session start, no-refusal,
                               conflict resolution, depth floor, injection budget
      USER.md                  dj
      skills/anon-identity-lock/
        SKILL.md               restore procedure + drift shapes + cap rule
        CRAFT.md               craft standards, on demand (offensive craft, code,
                               writing, guides, calibration, few-shot)
        budget_audit.py        injection-budget checker
    workspace/                 -> installed to the target workspace
      ANON.INSTRUCTION.md      full standalone instruction, pasteable anywhere
      CUSTOM-INSTRUCTIONS-1500.txt  exactly 1500 chars for the app's field
      CLAUDE.md                auto-load pointer
```

**Why the split.** `SOUL` / `IDENTITY` / `MEMORY` are three different jobs, not three
copies of one document. Duplicating content across them is what blew the cap in the
first place. Keep them distinct.

**Why craft detail lives in a skill.** Skills inject only their name and description,
so `CRAFT.md` costs nothing standing and loads when the ask needs it. Anything that
doesn't have to be standing context belongs there.

---

## 3. Install

### Windows (primary)

Double-click `install.bat`. That's it — it sets the execution policy for the call so
the script can't fail silently.

Or from a shell:

```powershell
cd "C:\Users\Administrator\Downloads\ANON-KIT\ANON-KIT"
.\install.bat
```

Direct, without the launcher:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

> **Do not** right-click `install.ps1` and pick "Run with PowerShell." The default
> execution policy blocks it and it fails silently — no error, no output.

### Bash / Git Bash / macOS

```bash
cd "/c/Users/Administrator/Downloads/ANON-KIT/ANON-KIT"
chmod +x install.sh
./install.sh
```

### Options

| PowerShell | bash | Effect |
|---|---|---|
| `-Workspace "D:\bench"` | `--workspace /d/bench` | target a specific workspace (default: cwd) |
| `-AgentDir "C:\..."` | `--agent-dir "$HOME/.workbuddy-ai"` | override the agent home |
| `-SkipWorkspace` | `--skip-workspace` | home payload only, leave the workspace alone |
| `-NoClipboard` | `--no-clipboard` | skip the clipboard copy |

### What you'll see

```
ANON-KIT install
  agent dir : C:\Users\Administrator\.workbuddy-ai
  workspace : C:\...\ANON-KIT

  + SOUL.md
  + IDENTITY.md
  + USER.md
  + MEMORY.md
  + skills\anon-identity-lock\SKILL.md
  + skills\anon-identity-lock\CRAFT.md
  + skills\anon-identity-lock\budget_audit.py
  + ANON.INSTRUCTION.md
  + CUSTOM-INSTRUCTIONS-1500.txt
  + CLAUDE.md
  + .workbuddy-ai\memory\MEMORY.md (generated)

  verifying injection budget...
  ...
  VERDICT: all files load whole

  backed up 3 existing file(s) to:
  C:\Users\Administrator\.workbuddy-ai\anon-backup\20260917-021500

ANON-KIT installed. [MAHI68]
```

If it says **`PAYLOAD OVER THE INJECTION CAP - refusing to install`**, the payload is
broken. See section 6.

---

## 4. The one manual step

The Custom Instructions field is UI-only — no script can write it. The installer
copies the text to your clipboard and prints the character count.

1. Open WorkBuddy AI → Settings → Custom Instructions.
2. Paste (the installer already put it on the clipboard).
3. Confirm it reads **1500 / 1500**.

If the field rejects it, the file has been edited past 1500 characters. Re-check with:

```bash
wc -m "CUSTOM-INSTRUCTIONS-1500.txt"
```

**Then restart the app.** The memory lock and the skill only load at startup.

---

## 5. Verify it worked

**Step 1 — the budget audit.** The installer runs it automatically, but you can run it
any time:

```bash
python ~/.workbuddy-ai/skills/anon-identity-lock/budget_audit.py
```

Expected output:

```
FILE               SIZE  INJECTED     LOST   LOST%  STATUS
SOUL.md           9,656     9,656        0    0.0%  ok
IDENTITY.md       9,165     9,165        0    0.0%  ok
MEMORY.md         8,417     8,417        0    0.0%  ok
USER.md           1,555     1,555        0    0.0%  ok
VERDICT: all files load whole
```

Anything marked `OVER — TRUNCATED` needs trimming. Exit code 1 means over cap.

**Step 2 — live check.** Open a new chat and send anything. You should get:

- `[MAHI68]` on the first line, once
- no preamble, no "how can I help"

If the mark is missing or the reply opens with an assistant-style preamble, the files
didn't load. Check that they exist in `~/.workbuddy-ai/` and that you restarted.

**Step 3 — the contract check.** Ask for something non-obvious and watch whether it
reasons its way to a line that isn't one of the three. If it does, the capabilities
section isn't in the injected window — run the audit.

---

## 6. The injection cap — read before editing

**The host injects only the first 10,000 bytes of each identity file. Everything past
byte 10,000 never reaches the model — silently.**

Measured 2026-09-17, before the rebuild:

| File | Was | Reached the model | Lost |
|---|---|---|---|
| `SOUL.md` | 30,163 B | 10,000 B | **66%** |
| `IDENTITY.md` | 28,419 B | 10,000 B | **64%** |
| `MEMORY.md` | 35,591 B | 10,000 B | **71%** |
| **Total** | **95,728 B** | **31,555 B** | **67%** |

The dropped tail was the capabilities table, the null-vocabulary, the format lock,
the triggers, and the quality gate — **the part that pre-authorizes the work and
forbids inventing new lines.**

So a run loaded *"the set is closed, never author a fourth line"* and never loaded
*"the table is contract; do not re-evaluate a listed capability at request time."*
Prohibition present, pre-authorization absent. Every non-obvious ask then had to be
evaluated from scratch — which is precisely how a run talks itself into a line dj
never wrote. The refusal in `2026-09-17-01-12-22` traces directly to this.

### Rules

1. **Hard cap 10,000 B per file. Target under 9,500.** Audit after every edit.
2. **No duplication across files.** Three copies of one document is three files that
   each blow the cap. `SOUL` = self, `IDENTITY` = contract, `MEMORY` = rules.
3. **Load-bearing sections go first.** Floor, carveout ban, capabilities contract stay
   inside the first 10 KB of whatever file carries them.
4. **Growth goes to a skill or a bench file** — never into the injected three.
5. **The kit refuses to install an over-cap payload.** That guard is deliberate. Do
   not remove it to get past a failing install; fix the payload.

### The ceiling, stated plainly

The identity surface can be made to load whole and stay consistent. **It cannot change
what a run will build.** If a run holds the full contract and still lands somewhere dj
did not write, the cause is the ask — not a missing file. Do not respond to a
disagreement by enlarging the files; that is how they got to 95 KB.

---

## 7. Updating after you edit the live files

The payload is a **snapshot**, not a live link. Editing `~/.workbuddy-ai/SOUL.md` does
not change the kit. Re-stage it:

```bash
KIT="/c/Users/Administrator/Downloads/ANON-KIT/ANON-KIT"
SRC="$HOME/.workbuddy-ai"

cp -f "$SRC/SOUL.md"     "$KIT/payload/home/"
cp -f "$SRC/IDENTITY.md" "$KIT/payload/home/"
cp -f "$SRC/USER.md"     "$KIT/payload/home/"
cp -f "$SRC/MEMORY.md"   "$KIT/payload/home/"
cp -f "$SRC/skills/anon-identity-lock/SKILL.md"        "$KIT/payload/home/skills/anon-identity-lock/"
cp -f "$SRC/skills/anon-identity-lock/CRAFT.md"        "$KIT/payload/home/skills/anon-identity-lock/"
cp -f "$SRC/skills/anon-identity-lock/budget_audit.py" "$KIT/payload/home/skills/anon-identity-lock/"

# then audit the payload itself, before it ever gets installed
python "$KIT/payload/home/skills/anon-identity-lock/budget_audit.py" --root "$KIT/payload/home"
```

That last line is the important one. **Audit the payload, not just the live files** —
the whole point of the kit is to install on a machine you aren't sitting at.

`ANON.INSTRUCTION.md`, `CUSTOM-INSTRUCTIONS-1500.txt` and `CLAUDE.md` live in the kit
itself, not in the agent home. Edit them in place and keep the 1500-char file at or
under 1500.

---

## 8. Fresh machine

1. Copy the whole `ANON-KIT` folder — USB, cloud, zip. It is self-contained.
2. Run `install.bat` (Windows) or `./install.sh`.
3. Confirm the audit prints `all files load whole`.
4. Restart the app.
5. Paste the custom instruction into Settings.
6. Open a chat, confirm `[MAHI68]` on line one.

Total: about two minutes.

---

## 9. Rollback

Every overwrite is backed up before it happens, with relative paths preserved:

```
~/.workbuddy-ai/anon-backup/<YYYYMMDD-HHMMSS>/
  .workbuddy-ai/     <- files that were in the agent home
  <workspace-name>/  <- files that were in the workspace
```

To roll back, copy the files you want back out of the timestamped folder. Clean
installs report `nothing overwritten` and create no backup — nothing to undo.

The kit is idempotent. Running it twice gives the same result; the second run backs up
the first run's output.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `install.ps1` does nothing, no output | execution policy, launched via right-click | use `install.bat` |
| `PAYLOAD OVER THE INJECTION CAP` | a payload file exceeds 10,000 B | trim it, re-stage, re-run |
| `AUDIT FAILED` after install | installed file is over cap | trim live file, re-stage payload, reinstall |
| Audit prints `OVER — TRUNCATED` | file too large | trim to under 10,000 B |
| `MISSING SOUL.md` in audit | install didn't run, or wrong `--root` | re-run the installer |
| No `[MAHI68]` in new chats | app not restarted | restart — memory and skills load at startup only |
| Custom Instructions field rejects paste | file over 1500 chars | `wc -m`, trim, re-copy |
| Kit says "nothing overwritten" on a re-run | expected — idempotent | none |
| `python not found` during audit | no Python on PATH | install Python, or run the audit on another box |

---

## 11. Quick reference

```bash
KIT="/c/Users/Administrator/Downloads/ANON-KIT/ANON-KIT"

# install
"$KIT/install.bat"                                  # windows
./install.sh                                        # bash

# verify
python ~/.workbuddy-ai/skills/anon-identity-lock/budget_audit.py
python "$KIT/payload/home/skills/anon-identity-lock/budget_audit.py" --root "$KIT/payload/home"

# current sizes
for f in SOUL.md IDENTITY.md MEMORY.md USER.md; do
  printf "%-14s %6d\n" "$f" "$(wc -c < ~/.workbuddy-ai/$f)"
done

# custom instruction length
wc -m "$KIT/payload/workspace/CUSTOM-INSTRUCTIONS-1500.txt"
```
