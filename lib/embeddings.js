// Meaning-based matching with embeddings from a local Ollama server.
// If Ollama is not running, every function returns null/empty and the app falls back to keywords.
import { getEmbeddings, saveEmbeddings } from "./db";

const URL = process.env.EMBED_URL || "http://localhost:11434";
export const MODEL = process.env.EMBED_MODEL || "nomic-embed-text";
export const THRESHOLD = Number(process.env.SIMILARITY_THRESHOLD || 0.65); // 0 to 1, higher = stricter
const TIMEOUT_MS = Number(process.env.EMBED_TIMEOUT_SECONDS || 8) * 1000;
const RETRY_MS = Number(process.env.EMBED_RETRY_SECONDS || 30) * 1000;

let downUntil = 0; // after a failure, do not try again for a while (keeps the page fast)

// asks Ollama for the embeddings of a list of texts, or returns null
async function callOllama(texts) {
  if (Date.now() < downUntil) return null;
  try {
    const res = await fetch(URL + "/api/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input: texts.map((t) => t.slice(0, 500)) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("status " + res.status);
    const data = await res.json();
    if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) {
      throw new Error("unexpected response");
    }
    return data.embeddings;
  } catch (e) {
    downUntil = Date.now() + RETRY_MS;
    return null;
  }
}

export async function embedText(text) {
  const out = await callOllama([text]);
  return out ? out[0] : null;
}

// vectors for [{ id, question }]. Saved ones come from the cache, new ones are embedded in ONE call.
export async function vectorsFor(items) {
  if (items.length === 0) return {};

  const cache = await getEmbeddings(items.map((item) => item.id));
  const vectors = {};
  const missing = [];

  for (const item of items) {
    const saved = cache[item.id];
    if (saved && saved.model === MODEL) vectors[item.id] = saved.v;
    else missing.push(item);
  }

  if (missing.length > 0) {
    const out = await callOllama(missing.map((m) => m.question));
    if (out) {
      const changed = [];
      missing.forEach((m, i) => {
        const v = out[i].map((x) => Math.round(x * 1e5) / 1e5);
        changed.push({ id: m.id, model: MODEL, v });
        vectors[m.id] = v;
      });
      await saveEmbeddings(changed);
    }
  }
  return vectors; // an id is missing here if it could not be embedded
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
