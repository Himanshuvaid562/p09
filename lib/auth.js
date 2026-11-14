import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createToken, readToken } from "./token";
import {
  createAuthSession,
  deleteAuthSession,
  deleteExpiredAuthSessions,
  isAuthSessionAlive,
} from "./db";

export const COOKIE = "p09_session";
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

// called on login: remembers the session on the server and returns the cookie value
export async function startSession(user) {
  const sid = crypto.randomBytes(24).toString("hex");
  const exp = Date.now() + EIGHT_HOURS;

  await deleteExpiredAuthSessions(); // keep the collection small
  await createAuthSession({ sid, username: user.username, exp });

  return createToken({
    sid,
    username: user.username,
    role: user.role,
    name: user.name,
    roll: user.roll || null,
    exp,
  });
}

// called on logout: the session is deleted on the server, so the old cookie stops working
export async function endSession(sid) {
  await deleteAuthSession(sid);
}

// returns the logged-in user, or null (cookie must be valid AND the session must still exist)
export async function getUser() {
  const info = await readToken(cookies().get(COOKIE)?.value);
  if (!info) return null;

  const alive = await isAuthSessionAlive(info.sid);
  return alive ? info : null;
}

// secure cookies are the default in production; set COOKIE_SECURE=false only for plain http
function useSecureCookie() {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === "true";
  }
  return process.env.NODE_ENV === "production";
}

export function setSessionCookie(res, token) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export function clearSessionCookie(res) {
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
}

// use at the top of an API route:  const denied = checkRole(user, "faculty"); if (denied) return denied;
export function checkRole(user, role) {
  if (!user) {
    const res = NextResponse.json({ error: "Please log in" }, { status: 401 });
    clearSessionCookie(res); // removes a stale cookie so the browser never gets stuck
    return res;
  }
  if (role && user.role !== role) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  return null;
}
