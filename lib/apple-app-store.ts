import fs from "fs";
import path from "path";
import {
  APIError,
  APIException,
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
} from "@apple/app-store-server-library";

const bundleId = process.env.APPLE_BUNDLE_ID ?? "com.wagzly.app";

// A purchase made via Xcode, TestFlight, or by Apple's App Review team is
// ALWAYS a Sandbox transaction, regardless of whether the app is live on
// the App Store — only a purchase made through the live App Store by a
// real customer is a Production transaction. So this backend has to be
// able to verify both kinds at all times, not just whichever one
// APPLE_ENVIRONMENT happens to name. We try the environment named by
// APPLE_ENVIRONMENT first (Production, once live, is the common case) and
// fall back to the other one only on the specific "this transaction/
// environment doesn't match" errors below — never on other failures.
const primaryEnvironment =
  process.env.APPLE_ENVIRONMENT === "sandbox"
    ? Environment.SANDBOX
    : Environment.PRODUCTION;
const fallbackEnvironment =
  primaryEnvironment === Environment.PRODUCTION
    ? Environment.SANDBOX
    : Environment.PRODUCTION;
const environmentsInOrder = [primaryEnvironment, fallbackEnvironment];

const cachedClients = new Map<Environment, AppStoreServerAPIClient>();
const cachedVerifiers = new Map<Environment, SignedDataVerifier>();

function getSigningKey(): string {
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing APPLE_PRIVATE_KEY");

  // .p8 keys are often stored in env vars with literal "\n" escapes.
  return privateKey.includes("\\n")
    ? privateKey.replace(/\\n/g, "\n")
    : privateKey;
}

// Lazily constructed so importing this module (e.g. during Next.js's
// build-time page data collection) never fails just because the Apple
// env vars aren't set yet — only calling these at request time does.
function getClientFor(environment: Environment): AppStoreServerAPIClient {
  const cached = cachedClients.get(environment);
  if (cached) return cached;

  const issuerId = process.env.APPLE_ISSUER_ID;
  const keyId = process.env.APPLE_KEY_ID;

  if (!issuerId) throw new Error("Missing APPLE_ISSUER_ID");
  if (!keyId) throw new Error("Missing APPLE_KEY_ID");

  const client = new AppStoreServerAPIClient(
    getSigningKey(),
    keyId,
    issuerId,
    bundleId,
    environment
  );

  cachedClients.set(environment, client);
  return client;
}

function getVerifierFor(environment: Environment): SignedDataVerifier {
  const cached = cachedVerifiers.get(environment);
  if (cached) return cached;

  const rootCertificate = fs.readFileSync(
    path.join(process.cwd(), "certs", "AppleRootCA-G3.cer")
  );

  const verifier = new SignedDataVerifier(
    [rootCertificate],
    true,
    environment,
    bundleId
  );

  cachedVerifiers.set(environment, verifier);
  return verifier;
}

/**
 * Fetches transaction info from Apple's App Store Server API, trying
 * `primaryEnvironment` first and retrying against the other environment
 * only if Apple reports the transaction doesn't exist there.
 */
export async function getAppleTransactionInfo(transactionId: string) {
  let lastError: unknown;

  for (const environment of environmentsInOrder) {
    try {
      return await getClientFor(environment).getTransactionInfo(transactionId);
    } catch (error) {
      lastError = error;
      const isWrongEnvironment =
        error instanceof APIException &&
        error.apiError === APIError.TRANSACTION_ID_NOT_FOUND;

      if (!isWrongEnvironment) throw error;
    }
  }

  throw lastError;
}

/**
 * Verifies and decodes a signed transaction, trying `primaryEnvironment`
 * first and retrying against the other environment only on Apple's
 * specific "wrong environment" verification failure.
 */
export async function verifyAppleTransaction(signedTransactionInfo: string) {
  let lastError: unknown;

  for (const environment of environmentsInOrder) {
    try {
      return await getVerifierFor(environment).verifyAndDecodeTransaction(
        signedTransactionInfo
      );
    } catch (error) {
      lastError = error;
      const isWrongEnvironment =
        error instanceof VerificationException &&
        error.status === VerificationStatus.INVALID_ENVIRONMENT;

      if (!isWrongEnvironment) throw error;
    }
  }

  throw lastError;
}

/**
 * Verifies and decodes an App Store Server Notification payload, with the
 * same environment fallback as {@link verifyAppleTransaction}.
 */
export async function verifyAppleNotification(signedPayload: string) {
  let lastError: unknown;

  for (const environment of environmentsInOrder) {
    try {
      return await getVerifierFor(environment).verifyAndDecodeNotification(
        signedPayload
      );
    } catch (error) {
      lastError = error;
      const isWrongEnvironment =
        error instanceof VerificationException &&
        error.status === VerificationStatus.INVALID_ENVIRONMENT;

      if (!isWrongEnvironment) throw error;
    }
  }

  throw lastError;
}

// Both APIException and VerificationException extend Error but call
// super() with no message, so the real detail lives on their own
// properties (.errorMessage/.apiError/.httpStatusCode, or .status/.cause)
// instead of the standard .message property.
export function describeAppleError(error: unknown): string {
  if (error instanceof APIException) {
    return `Apple API error (HTTP ${error.httpStatusCode}, code ${error.apiError}): ${
      error.errorMessage ?? "no message provided"
    }`;
  }

  if (error instanceof VerificationException) {
    return `Apple signature verification failed (status ${error.status}): ${
      error.cause?.message ?? "no further detail"
    }`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong.";
}

export function planFromProductId(productId?: string): "basic" | "pro" | null {
  const basicProductId = process.env.APPLE_BASIC_PRODUCT_ID ?? "wagzly_basic_monthly";
  const proProductId = process.env.APPLE_PRO_PRODUCT_ID ?? "wagzly_pro_monthly_v2";

  if (productId === proProductId) return "pro";
  if (productId === basicProductId) return "basic";
  return null;
}
