import { NextResponse } from "next/server";
import { getSession, updateQueriesWhere, updateSession } from "@/lib/db";
import { getUser, checkRole } from "@/lib/auth";

// PATCH -> the faculty who owns the session saves the recording link
export async function PATCH(req, { params }) {
  const user = await getUser();
  const denied = checkRole(user, "faculty");
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const recordingLink = typeof body.recordingLink === "string" ? body.recordingLink.trim() : "";

  const session = await getSession(params.id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.faculty !== user.name) {
    return NextResponse.json({ error: "This is not your session" }, { status: 403 });
  }

  if (!recordingLink || !recordingLink.startsWith("http")) {
    return NextResponse.json({ error: "Please paste a valid recording link" }, { status: 400 });
  }

  const updated = await updateSession(session.id, { recordingLink });

  // mark every linked query as answered, so students see it was covered
  await updateQueriesWhere(
    { sessionId: session.id, $or: [{ answer: "" }, { answer: { $exists: false } }] },
    {
      answer: 'Covered in the group session "' + session.title + '". Watch the recording in the Group Sessions section.',
      status: "Answered",
    }
  );

  return NextResponse.json(updated);
}
