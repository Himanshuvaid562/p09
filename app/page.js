import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  const dashboard = user && (user.role === "faculty" ? "/faculty" : "/student");

  return (
    <div>
      <div className="hero">
        <h1>{user ? "Welcome back, " + user.name : "Heard in Class, Lost After"}</h1>
        <p>
          Ask your doubts outside class and get them to the right faculty,
          without WhatsApp chaos or lost emails.
        </p>
        <div className="hero-buttons">
          {user ? (
            <a href={dashboard} className="btn btn-white">Go to my dashboard</a>
          ) : (
            <>
              <a href="/login" className="btn btn-white">Student Login</a>
              <a href="/login?role=faculty" className="btn btn-outline">Faculty Login</a>
            </>
          )}
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <div className="feature-icon">📝</div>
          <h3>Student Query Service</h3>
          <p className="muted">Submit academic questions with course details and track the reply.</p>
        </div>
        <div className="card">
          <div className="feature-icon">💬</div>
          <h3>Faculty Response Service</h3>
          <p className="muted">See queries by priority, send answers or schedule a meeting.</p>
        </div>
        <div className="card">
          <div className="feature-icon">🧭</div>
          <h3>Triage & Appointments</h3>
          <p className="muted">Queries are auto-categorised and routed to the correct faculty.</p>
        </div>
      </div>
    </div>
  );
}
