// Shared SMS text helpers: cleans up "smart" typography that accidentally
// forces a message into expensive Unicode encoding, calculates segment
// counts the way carriers actually do (not just length / 160), and splits
// messages that are still too long after cleanup into carrier-safe parts.
//
// Why this exists: a message typed on an iPhone almost always picks up
// curly apostrophes/quotes from autocorrect. The instant a single character
// falls outside the GSM-7 default alphabet, the *entire* message switches
// from 153 characters/segment to 67 characters/segment -- turning what
// looks like a normal-length text into 2x+ the segments (and cost), and
// occasionally tipping it over Telnyx's 10-segment concatenation limit
// entirely (rejected outright) even though the same wording in plain ASCII
// would have sent as a single ordinary text.
//
// Every non-ASCII character below is written as an explicit \u escape
// (never a pasted literal glyph), so the exact code points are unambiguous
// no matter how an editor/terminal renders them.

// GSM 03.38 default alphabet, basic table (all 127 printable/control
// characters -- 0x00-0x7F minus the 0x1B escape-to-extension-table code,
// which isn't a literal character on its own).
const GSM_7BIT_BASIC = "\u0040\u00A3\u0024\u00A5\u00E8\u00E9\u00F9\u00EC\u00F2\u00C7\u000A\u00D8\u00F8\u000D\u00C5\u00E5\u0394\u005F\u03A6\u0393\u039B\u03A9\u03A0\u03A8\u03A3\u0398\u039E\u00C6\u00E6\u00DF\u00C9\u00A4\u00A1\u00C4\u00D6\u00D1\u00DC\u00A7\u00BF\u00E4\u00F6\u00F1\u00FC\u00E0\u0020\u0021\u0022\u0023\u0025\u0026\u0027\u0028\u0029\u002A\u002B\u002C\u002D\u002E\u002F\u0030\u0031\u0032\u0033\u0034\u0035\u0036\u0037\u0038\u0039\u003A\u003B\u003C\u003D\u003E\u003F\u0041\u0042\u0043\u0044\u0045\u0046\u0047\u0048\u0049\u004A\u004B\u004C\u004D\u004E\u004F\u0050\u0051\u0052\u0053\u0054\u0055\u0056\u0057\u0058\u0059\u005A\u0061\u0062\u0063\u0064\u0065\u0066\u0067\u0068\u0069\u006A\u006B\u006C\u006D\u006E\u006F\u0070\u0071\u0072\u0073\u0074\u0075\u0076\u0077\u0078\u0079\u007A";
const GSM_7BIT_BASIC_SET = new Set(GSM_7BIT_BASIC);

// GSM extension table -- still GSM-7, but each of these costs 2 septets
// (an escape character + the character itself) instead of 1.
const GSM_7BIT_EXTENDED = "\u005E\u007B\u007D\u005C\u005B\u007E\u005D\u007C\u20AC";
const GSM_7BIT_EXTENDED_SET = new Set(GSM_7BIT_EXTENDED);

// Typographic characters commonly inserted by autocorrect, mapped to their
// plain GSM-7-safe equivalents. Deliberately narrow -- this never touches
// real content (wording), and never touches genuine emoji/foreign
// characters, since those can't be losslessly converted to ASCII.
const SMART_QUOTE_SINGLE = /[\u2018\u2019\u201A\u201B\uFF07]/g;
const SMART_QUOTE_DOUBLE = /[\u201C\u201D\u201E\u201F]/g;
const SMART_DASH = /[\u2012\u2013\u2014\u2015]/g;
const SMART_ELLIPSIS = /\u2026/g;
const SMART_BULLET = /[\u2022\u25CF\u25E6]/g;
const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\uFEFF]/g;
const UNICODE_SPACES = /[\u00A0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]/g;

/**
 * Replaces common "smart"/typographic characters (the kind iOS autocorrect
 * inserts) with their plain GSM-7-safe equivalents. Never touches real
 * content -- only punctuation style -- and deliberately leaves genuine
 * emoji/foreign characters alone, since those can't be losslessly
 * converted to ASCII.
 */
export function normalizeSmsText(text: string): string {
  return text
    .replace(SMART_QUOTE_SINGLE, "'")
    .replace(SMART_QUOTE_DOUBLE, '"')
    .replace(SMART_DASH, "-")
    .replace(SMART_ELLIPSIS, "...")
    .replace(SMART_BULLET, "*")
    .replace(ZERO_WIDTH_CHARS, "")
    .replace(UNICODE_SPACES, " ");
}

function isGsm7Compatible(text: string): boolean {
  for (const ch of text) {
    if (!GSM_7BIT_BASIC_SET.has(ch) && !GSM_7BIT_EXTENDED_SET.has(ch)) {
      return false;
    }
  }
  return true;
}

function gsm7Length(text: string): number {
  let length = 0;
  for (const ch of text) {
    length += GSM_7BIT_EXTENDED_SET.has(ch) ? 2 : 1;
  }
  return length;
}

/**
 * Accurate, encoding-aware segment count -- GSM-7 (160 chars single-part /
 * 153 chars per concatenated segment) if every character fits the GSM
 * default alphabet, otherwise Unicode/UCS-2 (70 / 67 chars). This matches
 * how Telnyx and carriers actually segment a message, unlike a flat
 * length/160 estimate.
 */
export function smsSegments(rawText: string): number {
  const text = rawText.trim();
  if (!text) return 1;

  if (isGsm7Compatible(text)) {
    const length = gsm7Length(text);
    return length <= 160 ? 1 : Math.ceil(length / 153);
  }

  const length = text.length;
  return length <= 70 ? 1 : Math.ceil(length / 67);
}

export const MAX_SINGLE_MESSAGE_SEGMENTS = 10;
export const MAX_TOTAL_SEGMENTS = 20;

// A literal-tagged discriminated union (not an "optional property" shape)
// so `if (!result.ok)` / `if (result.ok)` always narrows correctly in
// TypeScript, with no ambiguity about whether `parts` is defined.
export type SmsSplitResult =
  | { ok: true; parts: string[] }
  | { ok: false; error: string };

function findWordBoundary(text: string, maxChars: number): number {
  if (text.length <= maxChars) return text.length;
  const idx = text.lastIndexOf(" ", maxChars);
  return idx > 0 ? idx : maxChars;
}

/**
 * Normalizes the text, then:
 *  - returns it untouched (as a single part) if it already fits in one
 *    Telnyx-sendable message (<= 10 segments)
 *  - splits it into exactly two word-boundary-safe parts, labeled
 *    "(1/2)"/"(2/2)", if it needs more than 10 but no more than 20
 *    segments (10 + 10 always covers that range)
 *  - rejects it with a friendly error above 20 segments, or if it can't be
 *    split cleanly under the per-part limit (e.g. one very long unbroken
 *    word), rather than silently sending something that would still be
 *    rejected by Telnyx.
 */
export function splitLongSmsMessage(rawText: string): SmsSplitResult {
  const text = normalizeSmsText(rawText).trim();
  const totalSegments = smsSegments(text);

  if (totalSegments <= MAX_SINGLE_MESSAGE_SEGMENTS) {
    return { ok: true, parts: [text] };
  }

  if (totalSegments > MAX_TOTAL_SEGMENTS) {
    return {
      ok: false,
      error: `This message is too long to send (about ${totalSegments} SMS segments). Please shorten it to about ${MAX_TOTAL_SEGMENTS} segments or fewer.`,
    };
  }

  // Conservative per-part character budget, biased below the true
  // 10-segment cutoff to leave headroom for the "(n/2) " label and any
  // encoding edge cases in our estimate vs. the carrier's.
  const perPartCharBudget = isGsm7Compatible(text) ? 1300 : 560;

  const splitIndex = findWordBoundary(text, perPartCharBudget);
  const firstHalf = text.slice(0, splitIndex).trim();
  const secondHalf = text.slice(splitIndex).trim();

  if (!firstHalf || !secondHalf) {
    return {
      ok: false,
      error:
        "This message can't be split cleanly under the per-text segment limit. Please shorten it a bit and try again.",
    };
  }

  const part1 = `(1/2) ${firstHalf}`;
  const part2 = `(2/2) ${secondHalf}`;

  if (
    smsSegments(part1) > MAX_SINGLE_MESSAGE_SEGMENTS ||
    smsSegments(part2) > MAX_SINGLE_MESSAGE_SEGMENTS
  ) {
    return {
      ok: false,
      error:
        "This message can't be split cleanly under the per-text segment limit. Please shorten it a bit and try again.",
    };
  }

  return { ok: true, parts: [part1, part2] };
}
