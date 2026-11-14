import { NextResponse } from "next/server";
import { boardFor } from "@/lib/board";
import { getCourses } from "@/lib/users";
import { sharedKeywords, keywordTotal } from "@/lib/triage";
import { embedText, vectorsFor, cosine, THRESHOLD } from "@/lib/embeddings";
import { getUser, checkRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST { question, course } -> doubts already on the board that mean the same thing
export async function POST(req) {
  const user = await getUser();
  const denied = checkRole(user, "student");
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const text = typeof body.question === "string" ? body.question.trim() : "";
  const course = typeof body.course === "string" ? body.course : "";

  if (!(await getCourses(user.username)).includes(course)) {
    return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 });
  }
  if (text.length < 8) return NextResponse.json({ method: "none", matches: [] });

  const candidates = (await boardFor(user)).filter((b) => b.course === course && !b.mine);
  if (candidates.length === 0) return NextResponse.json({ method: "none", matches: [] });

  // 1. meaning (Ollama). typedVec is null when Ollama is not running.
  const typedVec = await embedText(text);
  const vectors = typedVec
    ? await vectorsFor(candidates.map((c) => ({ id: c.id, question: c.question })))
    : {};

  // 2. keywords (always checked, so nothing is lost if embeddings are missing)
  const need = Math.min(2, keywordTotal(text));

  const matches = candidates
    .map((c) => {
      const cos = typedVec && vectors[c.id] ? cosine(typedVec, vectors[c.id]) : 0;
      const byKeywords = need > 0 && sharedKeywords(text, c.question) >= need;
      const byMeaning = cos >= THRESHOLD;
      return { ...c, matched: byKeywords || byMeaning, score: Math.max(cos, byKeywords ? THRESHOLD : 0) };
    })
    .filter((c) => c.matched)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return NextResponse.json({ method: typedVec ? "meaning" : "keywords", matches });
}
