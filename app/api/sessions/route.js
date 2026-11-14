import { NextResponse } from "next/server";
import { getQueries, getSessions, insertSession, updateQuery } from "@/lib/db";
import { getUser, checkRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET -> students see sessions they are part of, faculty see their own sessions
export async function GET() {
  const user = await getUser();
  const denied = checkRole(user);
  if (denied) return denied;

  const filter = user.role === "student" ? { rolls: user.roll } : { faculty: user.name };
  const list = await getSessions(filter);

  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json(list);
}

// POST -> faculty creates a group session for several of their queries
export async function POST(req) {
  const user = await getUser();
  const denied = checkRole(user, "faculty");
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const scheduledAt = typeof body.scheduledAt === "string" ? body.scheduledAt : "";
  const meetLink = typeof body.meetLink === "string" ? body.meetLink.trim() : "";

  if (!title || !scheduledAt || !Array.isArray(body.queryIds) || body.queryIds.length === 0) {
    return NextResponse.json({ error: "Title, date/time and at least one query are required" }, { status: 400 });
  }
  if (!meetLink.startsWith("https://meet.google.com/")) {
    return NextResponse.json({ error: "Please paste a valid Google Meet link (https://meet.google.com/...)" }, { status: 400 });
  }

  // only queries assigned to this faculty can be added
  const queries = await getQueries({ id: { $in: body.queryIds } });
  const picked = queries.filter((q) => q.assignedTo === user.name);
  if (picked.length === 0) {
    return NextResponse.json({ error: "No valid queries selected" }, { status: 400 });
  }

  // everyone who asked the doubt + everyone who tapped "I have this doubt too" (no duplicates)
  const people = [];
  for (const q of picked) {
    for (const person of [{ roll: q.roll, name: q.name }, ...(q.alsoAsked || [])]) {
      if (!people.some((x) => x.roll === person.roll)) people.push(person);
    }
  }

  const session = {
    id: Date.now().toString(),
    title,
    faculty: user.name,
    course: [...new Set(picked.map((q) => q.course))].join(", "),
    meetLink,
    scheduledAt,
    queryIds: picked.map((q) => q.id),
    rolls: people.map((x) => x.roll),
    students: people.map((x) => x.name),
    recordingLink: "",
    createdAt: new Date().toISOString(),
  };

  await insertSession(session);

  await Promise.all(
    picked.map((q) => {
      const patch = { sessionId: session.id, appointment: scheduledAt };
      if (!q.answer) patch.status = "Scheduled";
      return updateQuery(q.id, patch);
    })
  );

  return NextResponse.json(session, { status: 201 });
}
