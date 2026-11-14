import { NextResponse } from "next/server";
import { boardFor } from "@/lib/board";
import { getUser, checkRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET -> every public doubt from the courses this student is enrolled in
export async function GET() {
  const user = await getUser();
  const denied = checkRole(user, "student");
  if (denied) return denied;

  const board = await boardFor(user);

  // most common doubts first, then newest
  board.sort((a, b) => b.alsoCount - a.alsoCount || b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json(board);
}
