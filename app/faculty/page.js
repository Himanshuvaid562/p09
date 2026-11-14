import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import FacultyView from "./FacultyView";

export const dynamic = "force-dynamic";

export default async function FacultyPage() {
  const user = await getUser();

  if (!user) redirect("/login");                    // not logged in
  if (user.role !== "faculty") redirect("/student"); // wrong role

  return <FacultyView user={{ name: user.name }} />;
}
