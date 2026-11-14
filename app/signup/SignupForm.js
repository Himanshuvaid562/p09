"use client";
import { useState } from "react";

export default function SignupForm({ courses, faculty, studentEnabled, facultyEnabled }) {
  const bothEnabled = studentEnabled && facultyEnabled;
  const [role, setRole] = useState(studentEnabled ? "student" : "faculty");
  const [student, setStudent] = useState({ name: "", roll: "", courses: [] });
  const [facultyForm, setFacultyForm] = useState({
    name: faculty[0]?.name || "",
    username: "",
    inviteCode: "",
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchRole(next) {
    setRole(next);
    setError("");
  }

  function changeStudent(e) {
    setStudent({ ...student, [e.target.name]: e.target.value });
  }

  function changeFaculty(e) {
    setFacultyForm({ ...facultyForm, [e.target.name]: e.target.value });
  }

  function toggleCourse(course) {
    setStudent({
      ...student,
      courses: student.courses.includes(course)
        ? student.courses.filter((c) => c !== course)
        : [...student.courses, course],
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (role === "student" && student.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (role === "faculty" && !facultyForm.name) {
      setError("Choose your faculty name.");
      return;
    }
    if (role === "student" && !student.roll.trim()) {
      setError("Please enter your roll number.");
      return;
    }
    if (role === "faculty" && !facultyForm.username.trim()) {
      setError("Choose a username.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (role === "student" && student.courses.length === 0) {
      setError("Select at least one course.");
      return;
    }
    if (role === "faculty" && !facultyForm.inviteCode.trim()) {
      setError("Enter the faculty invite code.");
      return;
    }

    const payload =
      role === "faculty"
        ? {
            role: "faculty",
            name: facultyForm.name,
            username: facultyForm.username,
            password,
            inviteCode: facultyForm.inviteCode,
          }
        : {
            role: "student",
            name: student.name,
            roll: student.roll,
            password,
            courses: student.courses,
          };

    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not create the account. Please try again.");
        return;
      }

      // tell other open tabs that we logged in, then go to the dashboard
      try { localStorage.setItem("p09_auth", String(Date.now())); } catch (e) {}
      window.location.replace(data.role === "faculty" ? "/faculty" : "/student");
    } catch (e) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!studentEnabled && !facultyEnabled) {
    return (
      <div className="login-box">
        <h1 className="page-title" style={{ textAlign: "center" }}>Signup is closed</h1>
        <div className="card">
          <p>Account registration is currently disabled by the administrator.</p>
          <a href="/login" className="btn btn-full">Go to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-box">
      <h1 className="page-title" style={{ textAlign: "center" }}>Create your account</h1>
      <p className="page-sub" style={{ textAlign: "center" }}>
        {role === "faculty"
          ? "Faculty registration requires the invite code from the administrator."
          : "Students can register with their roll number and courses."}
      </p>

      <div className="card">
        {bothEnabled && (
          <div className="tabs">
            <button
              type="button"
              className={"tab " + (role === "student" ? "active" : "")}
              onClick={() => switchRole("student")}
            >
              🎓 Student
            </button>
            <button
              type="button"
              className={"tab " + (role === "faculty" ? "active" : "")}
              onClick={() => switchRole("faculty")}
            >
              👩‍🏫 Faculty
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          {role === "student" ? (
            <>
              <label>Full name</label>
              <input
                name="name"
                placeholder="Your full name"
                autoComplete="name"
                value={student.name}
                onChange={changeStudent}
              />

              <label>Roll / registration number</label>
              <input
                name="roll"
                placeholder="Enter your roll number"
                autoComplete="username"
                value={student.roll}
                onChange={changeStudent}
              />
            </>
          ) : (
            <>
              <label>Faculty name</label>
              <select
                name="name"
                value={facultyForm.name}
                onChange={changeFaculty}
              >
                {faculty.map((person) => (
                  <option key={person.name} value={person.name}>
                    {person.name} — {person.courses.join(", ")}
                  </option>
                ))}
              </select>

              <label>Username</label>
              <input
                name="username"
                placeholder="Choose a username"
                autoComplete="username"
                value={facultyForm.username}
                onChange={changeFaculty}
              />

              <label>Faculty invite code</label>
              <input
                name="inviteCode"
                type="password"
                placeholder="Enter the code from the administrator"
                autoComplete="off"
                value={facultyForm.inviteCode}
                onChange={changeFaculty}
              />
            </>
          )}

          <div className="row">
            <div>
              <label>Password</label>
              <input
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label>Confirm password</label>
              <input
                type="password"
                placeholder="Type it again"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>

          {role === "student" && (
            <>
              <label>Your courses</label>
              <div className="course-grid">
                {courses.map((course) => (
                  <label className="check" key={course}>
                    <input
                      type="checkbox"
                      checked={student.courses.includes(course)}
                      onChange={() => toggleCourse(course)}
                    />
                    {course}
                  </label>
                ))}
              </div>
              <p className="muted" style={{ marginTop: -4 }}>
                You will only see doubts and submit questions for the courses you select.
              </p>
            </>
          )}

          {error && <div className="error">{error}</div>}

          <button type="submit" className="btn btn-full" disabled={busy}>
            {busy ? "Creating account..." : "Create " + role + " account"}
          </button>
        </form>
      </div>

      <p className="form-link">
        Already have an account? <a href="/login">Login</a>
      </p>
    </div>
  );
}
