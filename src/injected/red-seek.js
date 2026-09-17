/**
 * red-seek — the always-on ANON payload for DeepSeek.
 *
 * ONE block. The full instruction, complete, on every request. No fragments,
 * no degradation ladder, no conditional variants, no response rewriting.
 * Nothing is stripped from the instruction and nothing is shortened.
 *
 * It goes into the CHARACTER slot (BDS:RP, Character Name: ANON). That is the
 * slot that holds: the full ANON document dropped in as a persona/skill
 * survived where a rewritten user-message prefix did not.
 */

export const REDSEEK_VERSION = "5.0.0";

import {
  ANON_INSTRUCTION,
  ANON_GUIDE,
  ANON_README,
} from "./anon-kit.generated.js";

export const REDSEEK_FULL = ANON_INSTRUCTION;

/**
 * The one block, in the character slot. Injected on every request.
 */
export function buildRedSeekBlock() {
  return (
    "<BetterDeepSeek> <BDS:RP>" +
    "\nCharacter Name: ANON" +
    "\nUsage Domain: every request" +
    "\n---\n" +
    REDSEEK_FULL.trim() +
    "\n</BDS:RP> </BetterDeepSeek>"
  );
}

/**
 * Remove previously injected copies so the payload does not accumulate across
 * turns. Dedupe only — the instruction itself is never shortened or altered.
 */
/**
 * The remaining ANON-KIT files, in the skills slot -- the same slot the UI
 * upload writes to, so this is equivalent to uploading all three by hand.
 */
export function buildRedSeekSkillsBlock() {
  const body =
    "## ANON-KIT GUIDE\n" +
    ANON_GUIDE.trim() +
    "\n\n## ANON-KIT README\n" +
    ANON_README.trim();
  return (
    "<BetterDeepSeek> <BDS:SKILLS fingerprint=\"anon-kit\">\n" +
    body +
    "\n</BDS:SKILLS> </BetterDeepSeek>"
  );
}

export function stripRedSeekBlocks(text) {
  return String(text || "")
    .replace(/<REDSEEK>[\s\S]*?<\/REDSEEK>/gi, "")
    .replace(
      /<BetterDeepSeek>\s*<BDS:RP>[\s\S]*?<\/BDS:RP>\s*<\/BetterDeepSeek>/gi,
      ""
    );
}
