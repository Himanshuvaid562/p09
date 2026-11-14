import LogoutButton from "./LogoutButton";

// Plain <a> links on purpose: every click is a real page load, so the server checks the login each time.
export default function Navbar({ user }) {
  return (
    <div className="navbar">
      <div className="navbar-inner">
        <a href="/" className="brand">📚 Heard in Class</a>

        <div className="nav-links">
          <a href="/">Home</a>

          {user ? (
            <>
              <a href={user.role === "faculty" ? "/faculty" : "/student"}>
                {user.role === "faculty" ? "Dashboard" : "My Queries"}
              </a>
              <span className="nav-user">
                {user.name} <span className="badge group">{user.role}</span>
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <a href="/signup">Sign up</a>
              <a href="/login">Login</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
