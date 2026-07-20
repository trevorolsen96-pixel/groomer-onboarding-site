import fs from "fs";
import path from "path";
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";

const issuerId = process.env.APPLE_ISSUER_ID;
const keyId = process.env.APPLE_KEY_ID;
const privateKey = process.env.APPLE_PRIVATE_KEY;
const bundleId = process.env.APPLE_BUNDLE_ID ?? "com.wagzly.app";

if (!issuerId) throw new Error("Missing APPLE_ISSUER_ID");
if (!keyId) throw new Error("Missing APPLE_KEY_ID");
if (!privateKey) throw new Error("Missing APPLE_PRIVATE_KEY");

// .p8 keys are often stored in env vars with literal "\n" escapes.
const signingKey = privateKey.includes("\\n")
  ? privateKey.replace(/\\n/g, "\n")
  : privateKey;

const environment =
  process.env.APPLE_ENVIRONMENT === "production"
    ? Environment.PRODUCTION
    : Environment.SANDBOX;

export const appleAppStoreClient = new AppStoreServerAPIClient(
  signingKey,
  keyId,
  issuerId,
  bundleId,
  environment
);

const rootCertificate = fs.readFileSync(
  path.join(process.cwd(), "certs", "AppleRootCA-G3.cer")
);

export const appleSignedDataVerifier = new SignedDataVerifier(
  [rootCertificate],
  true,
  environment,
  bundleId
);

export function planFromProductId(productId?: string): "basic" | "pro" | null {
  const basicProductId = process.env.APPLE_BASIC_PRODUCT_ID ?? "wagzly_basic_monthly";
  const proProductId = process.env.APPLE_PRO_PRODUCT_ID ?? "wagzly_pro_monthly";

  if (productId === proProductId) return "pro";
  if (productId === basicProductId) return "basic";
  return null;
}
