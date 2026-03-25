import crypto from "node:crypto";
import { getSecret } from "./config.js";

function verifySignature(payload, signature) {
  const secret = getSecret();
  if (!secret) return true;
  if (!signature) return false;
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export { verifySignature };
