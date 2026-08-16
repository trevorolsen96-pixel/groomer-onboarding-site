import crypto from "crypto";

// Telnyx signs every webhook request (SMS/MMS inbound events, voice
// call-control events) with Ed25519 over `${timestamp}|${rawBody}`, sent as
// the `telnyx-signature-ed25519` (base64 signature) and `telnyx-timestamp`
// headers. Without checking this, anyone who finds a webhook URL can POST a
// forged event -- e.g. spoofing a "STOP"/"NO" customer reply to cancel a
// real appointment, or injecting arbitrary content into a business's
// Messages inbox.
//
// The public key lives in the Telnyx portal under Account Settings ->
// Public Key, as a base64-encoded raw 32-byte Ed25519 key. Node's crypto
// module needs it wrapped in a minimal DER/SPKI envelope to build a usable
// KeyObject -- this is the standard fixed prefix for a raw Ed25519 public
// key (well-documented technique, not Telnyx-specific).
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function buildPublicKey(base64Key: string): crypto.KeyObject {
  const rawKey = Buffer.from(base64Key, "base64");
  const der = Buffer.concat([ED25519_SPKI_PREFIX, rawKey]);
  return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
}

export type TelnyxSignatureResult = "verified" | "invalid" | "unconfigured";

/**
 * Verifies a Telnyx webhook request signature against TELNYX_PUBLIC_KEY.
 *
 * Returns:
 *  - "verified"     -- signature checked out, trust the payload.
 *  - "invalid"      -- a public key IS configured but the signature is
 *    missing or doesn't match -- the caller should reject the request.
 *  - "unconfigured" -- TELNYX_PUBLIC_KEY isn't set in this environment, so
 *    verification was skipped (fails OPEN on purpose: shipping this check
 *    should never silently break inbound SMS/voice in production just
 *    because the env var hasn't been added yet). Set TELNYX_PUBLIC_KEY in
 *    Vercel to actually start enforcing this.
 */
export function verifyTelnyxSignature({
  rawBody,
  signatureHeader,
  timestampHeader,
}: {
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
}): TelnyxSignatureResult {
  const publicKeyBase64 = process.env.TELNYX_PUBLIC_KEY;

  if (!publicKeyBase64) {
    console.warn(
      "[telnyx-webhook] TELNYX_PUBLIC_KEY is not set -- webhook signature " +
        "verification is being skipped, so this endpoint currently trusts " +
        "any POST body. Set TELNYX_PUBLIC_KEY (Telnyx portal -> Account " +
        "Settings -> Public Key) in Vercel to close this."
    );
    return "unconfigured";
  }

  if (!signatureHeader || !timestampHeader) {
    return "invalid";
  }

  try {
    const publicKey = buildPublicKey(publicKeyBase64);
    const signedPayload = `${timestampHeader}|${rawBody}`;
    const signature = Buffer.from(signatureHeader, "base64");
    const isValid = crypto.verify(
      null,
      Buffer.from(signedPayload),
      publicKey,
      signature
    );
    return isValid ? "verified" : "invalid";
  } catch (error) {
    console.error("[telnyx-webhook] Signature verification error:", error);
    return "invalid";
  }
}
