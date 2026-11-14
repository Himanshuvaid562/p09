import { NextResponse } from "next/server";
import { getQuery, getSession, updateQuery, updateSession } from "@/lib/db";
import { getCourses } from "@/lib/users";
import { getUser, checkRole } from "@/lib/auth";

// POST -> a classmate says "I have this doubt too" (press again to undo)
export async function POST(req, { params }) {
  const user = await getUser();
  const denied = checkRole(user, "student");
  if (denied) return denied;

  const q = await getQuery(params.id);

  // not visible to this student (other course, or private) -> pretend it does not exist
  if (!q || q.private || !(await getCourses(user.username)).includes(q.course)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (q.roll === user.roll) {
    return NextResponse.json({ error: "This is your own doubt" }, { status: 400 });
  }

  const alsoAsked = q.alsoAsked || [];
  const index = alsoAsked.findIndex((a) => a.roll === user.roll);
  const joined = index === -1;

  if (joined) alsoAsked.push({ roll: user.roll, name: user.name });
  else alsoAsked.splice(index, 1);

  await updateQuery(q.id, { alsoAsked });

  // if a group session is already planned for this doubt, join / leave it too
  if (q.sessionId) {
    const session = await getSession(q.sessionId);
    if (session) {
      const rolls = [...session.rolls];
      const students = [...session.students];

      if (joined && !rolls.includes(user.roll)) {
        rolls.push(user.roll);
        students.push(user.name);
      }
      if (!joined) {
        const i = rolls.indexOf(user.roll);
        if (i !== -1) {
          rolls.splice(i, 1);
          students.splice(i, 1);
        }
      }

      await updateSession(session.id, { rolls, students });
    }
  }

  return NextResponse.json({ iHaveThis: joined, alsoCount: alsoAsked.length });
}
