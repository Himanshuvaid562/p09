import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { courseFaculty } from "@/lib/triage";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getUser();

  // already logged in -> the signup page is never shown
  if (user) redirect(user.role === "faculty" ? "/faculty" : "/student");

  const faculty = [...new Set(Object.values(courseFaculty))].map((name) => ({
    name,
    courses: Object.keys(courseFaculty).filter((course) => courseFaculty[course] === name),
  }));

  return (
    <SignupForm
      courses={Object.keys(courseFaculty)}
      faculty={faculty}
      studentEnabled={process.env.ALLOW_STUDENT_SIGNUP !== "false"}
      facultyEnabled={Boolean((process.env.FACULTY_INVITE_CODE || "").trim())}
    />
  );
}
