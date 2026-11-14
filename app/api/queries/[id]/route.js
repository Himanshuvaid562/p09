import { NextResponse } from "next/server";
import { getQuery, updateQuery } from "@/lib/db";
import { getUser, checkRole } from "@/lib/auth";

// PATCH -> only the assigned faculty can answer or schedule
export async function PATCH(req, { params }) {
  const user = await getUser();
  const denied = checkRole(user, "faculty");
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const appointment = typeof body.appointment === "string" ? body.appointment.trim() : "";

  const q = await getQuery(params.id);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (q.assignedTo !== user.name) {
    return NextResponse.json({ error: "This query is not assigned to you" }, { status: 403 });
  }

  const patch = {};
  if (answer) {
    patch.answer = answer;
    patch.status = "Answered";
  }
  if (appointment) {
    patch.appointment = appointment;
    if (!answer && !q.answer) patch.status = "Scheduled";
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await updateQuery(params.id, patch);
  return NextResponse.json(updated);
}
