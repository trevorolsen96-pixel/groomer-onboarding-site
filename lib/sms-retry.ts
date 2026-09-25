// Shared retry policy for outbound SMS -- used by both the direct-send
// route (app/api/messages/send) and the queue processor cron
// (app/api/sms/process-queue) so the two never drift on what counts as
// "worth retrying" or how long to keep trying.

export type SmsFailureClass = "transient" | "permanent";

// Heuristic, not a Telnyx error-code lookup table -- Telnyx's error
// shape varies by failure type, but the message text reliably mentions
// the specific problem. Defaults to "transient" for anything
// unrecognized: retrying a few times over a bounded window is cheap,
// silently giving up on a message that would've gone through on the
// next attempt is not. Only patterns we're confident represent a
// permanent, unfixable-by-retrying problem short-circuit straight to
// "permanent" so we're not still hammering Telnyx with the same invalid
// number 30 minutes later.
const PERMANENT_ERROR_PATTERNS: RegExp[] = [
  /invalid['" ]*(to|from|phone|destination)/i,
  /not a valid (phone )?number/i,
  /is not owned by/i,
  /unauthorized/i,
  /\bblocked\b/i,
  /opted out/i,
  /\blandline\b/i,
  /destination.*not reachable/i,
  /does not have a phone number/i,
  /number is not valid/i,
];

export function classifySmsError(error: unknown): SmsFailureClass {
  const message = error instanceof Error ? error.message : String(error);
  return PERMANENT_ERROR_PATTERNS.some((pattern) => pattern.test(message))
    ? "permanent"
    : "transient";
}

// Direct messages retry every 5 minutes (matching the cron's own tick)
// so they resolve quickly, capped at a wall-clock age rather than a
// message-type-specific attempt count -- a groomer watching a live
// conversation shouldn't see "will retry" for more than about half an
// hour before it's clear something's actually wrong.
export const MAX_ATTEMPTS_DIRECT_MESSAGE = 6;
export const DIRECT_MESSAGE_MAX_AGE_MINUTES = 30;

// Everything else (reminders, confirmations, reschedule/cancellation
// notices) isn't blocking a live screen, so it gets a longer spread --
// but reminders specifically also stop once the appointment they're
// about has already happened (checked separately by the caller, since
// only reminder rows carry an appointment_id worth checking).
export const MAX_ATTEMPTS_DEFAULT = 5;
const DEFAULT_BACKOFF_MINUTES = [5, 15, 60, 240]; // delay before attempt 2, 3, 4, 5

// attemptNumber is 1-indexed and refers to the attempt about to be
// scheduled (i.e. call with attemptCount + 1 after a failure to get the
// delay before the *next* try).
export function nextRetryDelayMinutes(
  messageType: string,
  attemptNumber: number
): number {
  if (messageType === "direct_message") return 5;

  const index = Math.min(
    Math.max(attemptNumber - 2, 0),
    DEFAULT_BACKOFF_MINUTES.length - 1
  );
  return DEFAULT_BACKOFF_MINUTES[index];
}
