import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getUser();

  // already logged in -> the login page is never shown
  if (user) redirect(user.role === "faculty" ? "/faculty" : "/student");

  return <LoginForm />;
}
