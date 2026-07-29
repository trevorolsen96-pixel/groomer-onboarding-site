import fs from "fs";
import path from "path";
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";

const bundleId = process.env.APPLE_BUNDLE_ID ?? "com.wagzly.app";

const environment =
  process.env.APPLE_ENVIRONMENT === "production"
    ? Environment.PRODUCTION
    : Environment.SANDBOX;

let cachedClient: AppStoreServerAPIClient | null = null;
let cachedVerifier: SignedDataVerifier | null = null;

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
export function getAppleAppStoreClient(): AppStoreServerAPIClient {
  if (cachedClient) return cachedClient;

  const issuerId = process.env.APPLE_ISSUER_ID;
  const keyId = process.env.APPLE_KEY_ID;

  if (!issuerId) throw new Error("Missing APPLE_ISSUER_ID");
  if (!keyId) throw new Error("Missing APPLE_KEY_ID");

  cachedClient = new AppStoreServerAPIClient(
    getSigningKey(),
    keyId,
    issuerId,
    bundleId,
    environment
  );

  return cachedClient;
}

export function getAppleSignedDataVerifier(): SignedDataVerifier {
  if (cachedVerifier) return cachedVerifier;

  const rootCertificate = fs.readFileSync(
    path.join(process.cwd(), "certs", "AppleRootCA-G3.cer")
  );

  cachedVerifier = new SignedDataVerifier(
    [rootCertificate],
    true,
    environment,
    bundleId
  );

  return cachedVerifier;
}

export function planFromProductId(productId?: string): "basic" | "pro" | null {
  const basicProductId = process.env.APPLE_BASIC_PRODUCT_ID ?? "wagzly_basic_monthly";
  const proProductId = process.env.APPLE_PRO_PRODUCT_ID ?? "wagzly_pro_monthly_v2";

  if (productId === proProductId) return "pro";
  if (productId === basicProductId) return "basic";
  return null;
}
