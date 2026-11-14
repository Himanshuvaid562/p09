import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getAvailableCourses } from "@/lib/courses";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getUser();

  // already logged in -> the signup page is never shown
  if (user) redirect(user.role === "faculty" ? "/faculty" : "/student");

  return (
    <SignupForm
      courses={await getAvailableCourses()}
      studentEnabled={process.env.ALLOW_STUDENT_SIGNUP !== "false"}
      facultyEnabled={Boolean((process.env.FACULTY_INVITE_CODE || "").trim())}
    />
  );
}
