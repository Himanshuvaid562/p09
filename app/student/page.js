import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getCourses } from "@/lib/users";
import StudentView from "./StudentView";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const user = await getUser();

  if (!user) redirect("/login");                    // not logged in
  if (user.role !== "student") redirect("/faculty"); // wrong role

  return (
    <StudentView
      user={{ name: user.name, roll: user.roll }}
      courses={await getCourses(user.username)}
    />
  );
}
