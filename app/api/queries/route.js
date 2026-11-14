import { NextResponse } from "next/server";
import { getQueries, insertQuery } from "@/lib/db";
import { triage, isPersonal, sharedKeywords } from "@/lib/triage";
import { vectorsFor, cosine, THRESHOLD } from "@/lib/embeddings";
import { getCourses } from "@/lib/users";
import { getUser, checkRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET -> students get their own queries, faculty get the ones assigned to them
export async function GET() {
  const user = await getUser();
  const denied = checkRole(user);
  if (denied) return denied;

  let list = await getQueries();
  let matching = "";
  if (user.role === "student") {
    list = list
      .filter((q) => q.roll === user.roll)
      // a student only sees HOW MANY classmates share the doubt, not who
      .map((q) => ({ ...q, alsoCount: (q.alsoAsked || []).length, alsoAsked: undefined }));
  } else {
    list = list.filter((q) => q.assignedTo === user.name);

    // similar doubts (same course): by meaning if Ollama is running, plus shared keywords
    const open = list.filter((q) => !q.sessionId);
    const vectors = await vectorsFor(open.map((q) => ({ id: q.id, question: q.question })));
    const same = (a, b) =>
      sharedKeywords(a.question, b.question) >= 2 ||
      (vectors[a.id] && vectors[b.id] && cosine(vectors[a.id], vectors[b.id]) >= THRESHOLD);

    list = list.map((q) => ({
      ...q,
      similarIds: q.sessionId ? [] : open.filter((o) => o.id !== q.id && o.course === q.course && same(q, o)).map((o) => o.id),
    }));
    if (open.length > 0) matching = open.every((q) => vectors[q.id]) ? "meaning" : "keywords";
  }

  // High priority first, then newest first
  list.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "High" ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return NextResponse.json(list, { headers: { "X-Matching": matching } });
}

// POST -> only students can submit a query, and only for their own courses
export async function POST(req) {
  const user = await getUser();
  const denied = checkRole(user, "student");
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const course = typeof body.course === "string" ? body.course.trim() : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (!course || !question) {
    return NextResponse.json({ error: "Course and question are required" }, { status: 400 });
  }
  if (!(await getCourses(user.username)).includes(course)) {
    return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 });
  }

  // Integration: student query -> triage -> saved with category/priority/faculty
  const result = triage(course, question);

  const query = {
    id: Date.now().toString(),
    name: user.name,
    roll: user.roll,
    course,
    question,
    ...result,
    private: !!body.private || isPersonal(result.category), // private = only faculty can see it
    alsoAsked: [], // classmates who tapped "I have this doubt too"
    status: "Open",
    answer: "",
    appointment: "",
    createdAt: new Date().toISOString(),
  };

  await insertQuery(query);
  return NextResponse.json(query, { status: 201 });
}
