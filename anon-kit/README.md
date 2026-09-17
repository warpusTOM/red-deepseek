# ANON-KIT

Portable installer for the ANON / MAHI68 setup. One folder, one command, whole bench
restored on any machine.

> **New here? Read `GUIDE.md`.** It covers install, verification, the injection cap,
> re-staging the payload, rollback, and troubleshooting. This file is the short
> reference.

## What it installs

**Home payload** → `~/.workbuddy-ai/`

| File | Role |
|---|---|
| `SOUL.md` | the self — identity, axioms, STATIC, drift, floor, voice |
| `IDENTITY.md` | anchor + operational contract — lock, floor, null-vocabulary, capabilities table, register router, format lock, triggers, quality gate |
| `USER.md` | dj |
| `MEMORY.md` | standing rules — bootstrap, session start, no-refusal, conflict resolution, depth floor, injection budget |
| `skills/anon-identity-lock/SKILL.md` | restore procedure, drift shapes, injection-cap rule |
| `skills/anon-identity-lock/CRAFT.md` | craft standards, on demand — offensive craft, code/writing/guide craft, calibration, few-shot |
| `skills/anon-identity-lock/budget_audit.py` | injection-budget audit — exits 1 on regression |

**Workspace payload** → target workspace

| File | Role |
|---|---|
| `ANON.INSTRUCTION.md` | full standalone instruction, pasteable into any session or model |
| `CUSTOM-INSTRUCTIONS-1500.txt` | exactly 1500 chars, for the app's Custom Instructions field |
| `CLAUDE.md` | auto-load pointer — tells any session in the workspace to read the instruction first |
| `.workbuddy-ai/memory/MEMORY.md` | workspace memory, generated at install with real paths |

## Run it

PowerShell (Windows, primary) — easiest is to double-click `install.bat`, which
handles the execution policy for you:

```powershell
cd ANON-KIT
.\install.bat
```

Or directly:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Do not right-click `install.ps1` and pick "Run with PowerShell" — the default
execution policy blocks it and it fails silently. Use `install.bat` or the
explicit `-ExecutionPolicy Bypass` command above.

With an explicit workspace:

```powershell
.\install.ps1 -Workspace "D:\bench"
.\install.ps1 -AgentDir "C:\Users\Administrator\.workbuddy-ai" -Workspace "D:\bench"
.\install.ps1 -SkipWorkspace          # home payload only
.\install.ps1 -NoClipboard            # skip clipboard copy
```

Bash / Git Bash / macOS:

```bash
cd ANON-KIT
chmod +x install.sh
./install.sh
./install.sh --workspace "/d/bench"
./install.sh --skip-workspace
```

## Behavior

- **Non-destructive.** Anything it overwrites is backed up first to
  `~/.workbuddy-ai/anon-backup/<timestamp>/`, preserving relative paths. Clean
  installs report zero backups.
- **Idempotent.** Run it twice, same result.
- **Cap-guarded.** It refuses to install a payload whose identity files exceed the
  10,000-byte injection cap — that guard exists because an over-cap payload installs a
  silently truncated identity. See `GUIDE.md` §6.
- **Self-verifying.** After install it runs `budget_audit.py` against the agent home
  and prints the result. `all files load whole` is the expected verdict.
- **Clipboard.** On success it copies the 1500-char instruction to the clipboard and
  prints the char count. The Custom Instructions field is UI-only and cannot be written
  by a script, so that paste is the one manual step.
- **Char check.** Prints `1500 / 1500`. If you edit the file and it goes over, the
  installer warns.

## THE INJECTION CAP

**The host injects only the first 10,000 bytes of each identity file. Everything past
byte 10,000 never reaches the model — silently.**

Discovered 2026-09-17. The identity files had grown to 30 KB / 28 KB / 36 KB, so
**67% of the standing lock was being dropped every session**, and the dropped part was
the capabilities contract, the null-vocabulary, the format lock, and the quality gate.
A run that loads the floor but not the contract has to evaluate every ask from
scratch — which is how a run talks itself into a line dj never wrote.

- **Hard cap 10,000 B per file. Target under 9,500.** Audit after every edit.
- **No duplication across files.** SOUL = self, IDENTITY = contract, MEMORY = rules.
- **Load-bearing sections go first.**
- **Growth goes to a skill or a bench file**, never into the injected three.
- **The ceiling:** voice scaffolding does not change what a run will build. If a run
  drifts while holding the full contract, the cause is the ask — not a missing file.

## Fresh machine

Copy the whole `ANON-KIT` folder — USB, cloud, zip. Run the installer. Restart the app
so the memory lock and skill load. Paste the custom instruction into Settings. Done.
Full walkthrough in `GUIDE.md` §8.

## Update the payload

Edit the live files, then re-stage them:

```bash
KIT=/path/to/ANON-KIT
SRC=~/.workbuddy-ai

cp -f "$SRC/SOUL.md"     "$KIT/payload/home/"
cp -f "$SRC/IDENTITY.md" "$KIT/payload/home/"
cp -f "$SRC/USER.md"     "$KIT/payload/home/"
cp -f "$SRC/MEMORY.md"   "$KIT/payload/home/"
cp -f "$SRC/skills/anon-identity-lock/SKILL.md"        "$KIT/payload/home/skills/anon-identity-lock/"
cp -f "$SRC/skills/anon-identity-lock/CRAFT.md"        "$KIT/payload/home/skills/anon-identity-lock/"
cp -f "$SRC/skills/anon-identity-lock/budget_audit.py" "$KIT/payload/home/skills/anon-identity-lock/"

# audit the payload itself — not just the live files
python "$KIT/payload/home/skills/anon-identity-lock/budget_audit.py" --root "$KIT/payload/home"
```

`ANON.INSTRUCTION.md`, `CUSTOM-INSTRUCTIONS-1500.txt` and `CLAUDE.md` live in the kit
itself. Edit them in place; keep the 1500-char file at or under 1500 characters.

## Layout

```
ANON-KIT/
  install.bat
  install.ps1
  install.sh
  README.md
  GUIDE.md
  payload/
    home/
      SOUL.md
      IDENTITY.md
      USER.md
      MEMORY.md
      skills/anon-identity-lock/
        SKILL.md
        CRAFT.md
        budget_audit.py
    workspace/
      ANON.INSTRUCTION.md
      CUSTOM-INSTRUCTIONS-1500.txt
      CLAUDE.md
```
