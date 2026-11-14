import { NextResponse } from "next/server";
import { readToken } from "@/lib/token";

// First, cheap line of defence. It only checks the cookie signature.
// The pages themselves (app/*/page.js) do the full check against the server-side session.
export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const user = await readToken(req.cookies.get("p09_session")?.value);
  const go = (path) => NextResponse.redirect(new URL(path, req.url));

  if (pathname.startsWith("/student") || pathname.startsWith("/faculty")) {
    if (!user) return go("/login");
    const needed = pathname.startsWith("/faculty") ? "faculty" : "student";
    if (user.role !== needed) return go(user.role === "faculty" ? "/faculty" : "/student");
  }

  // never let the browser cache these pages (stops the back button showing old pages)
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}

export const config = { matcher: ["/login", "/signup", "/student/:path*", "/faculty/:path*"] };
