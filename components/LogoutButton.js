"use client";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    try { localStorage.setItem("p09_auth", String(Date.now())); } catch (e) {} // tell other tabs
    window.location.replace("/login"); // replace, so the back button can't return to the dashboard
  }

  return (
    <button className="btn btn-light btn-small" onClick={logout}>Logout</button>
  );
}
