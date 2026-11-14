// Signed cookie token. Uses Web Crypto so it also runs inside middleware (edge runtime).
const encoder = new TextEncoder();

function secretKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not set. Add a long random value to the environment (see .env.example).");
    }
    return "dev-secret-change-me";
  }

  return secret;
}

function toBase64Url(bytes) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function sign(data) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw", encoder.encode(secretKey()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createToken(info) {
  const payload = toBase64Url(encoder.encode(JSON.stringify(info)));
  return payload + "." + (await sign(payload));
}

// returns the user info inside the token, or null if missing / tampered / expired
export async function readToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!sameText(sig, await sign(payload))) return null;

  try {
    const info = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (info.exp < Date.now()) return null;
    return info;
  } catch {
    return null;
  }
}
