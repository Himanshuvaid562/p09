import { NextResponse } from "next/server";
import { getUser, checkRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUser();
  const denied = checkRole(user);
  if (denied) return denied;
  return NextResponse.json({ name: user.name, role: user.role, roll: user.roll });
}
