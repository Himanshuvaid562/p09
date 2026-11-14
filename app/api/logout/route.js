import { NextResponse } from "next/server";
import { getUser, endSession, clearSessionCookie } from "@/lib/auth";

export async function POST() {
  const user = await getUser();
  if (user) endSession(user.sid); // delete the session on the server

  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
