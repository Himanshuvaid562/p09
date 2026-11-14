import Navbar from "@/components/Navbar";
import AuthSync from "@/components/AuthSync";
import { getUser } from "@/lib/auth";
import "./globals.css";

export const metadata = { title: "Heard in Class, Lost After" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const user = await getUser();

  return (
    <html lang="en">
      <body>
        <AuthSync loggedIn={!!user} />
        <Navbar user={user} />
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
