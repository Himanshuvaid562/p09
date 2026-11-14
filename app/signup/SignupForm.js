"use client";
import { useState } from "react";

export default function SignupForm({ courses, studentEnabled, facultyEnabled }) {
  const bothEnabled = studentEnabled && facultyEnabled;
  const [role, setRole] = useState(studentEnabled ? "student" : "faculty");
  const [student, setStudent] = useState({ name: "", roll: "" });
  // the student's courses: a title (e.g. PHY) and a code (e.g. 101)
  const [studentNewCourses, setStudentNewCourses] = useState([{ title: "", code: "" }]);
  const [facultyForm, setFacultyForm] = useState({
    name: "",
    regNo: "",
    username: "",
    inviteCode: "",
  });
  // courses that already exist and have no faculty account yet
  const [existingCourses, setExistingCourses] = useState([]);
  // new custom courses: a title (e.g. INT) and a code (e.g. 305)
  const [newCourses, setNewCourses] = useState([{ title: "", code: "" }]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const claimableCourses = courses.filter((course) => course.claimable);

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

  function changeStudentNewCourse(index, field, value) {
    setStudentNewCourses(
      studentNewCourses.map((course, i) =>
        i === index ? { ...course, [field]: value } : course
      )
    );
  }

  function addStudentNewCourse() {
    setStudentNewCourses([...studentNewCourses, { title: "", code: "" }]);
  }

  function removeStudentNewCourse(index) {
    setStudentNewCourses(studentNewCourses.filter((_, i) => i !== index));
  }

  function toggleExistingCourse(course) {
    setExistingCourses(
      existingCourses.includes(course)
        ? existingCourses.filter((c) => c !== course)
        : [...existingCourses, course]
    );
  }

  function changeNewCourse(index, field, value) {
    setNewCourses(
      newCourses.map((course, i) =>
        i === index ? { ...course, [field]: value } : course
      )
    );
  }

  function addNewCourse() {
    setNewCourses([...newCourses, { title: "", code: "" }]);
  }

  function removeNewCourse(index) {
    setNewCourses(newCourses.filter((_, i) => i !== index));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (role === "student" && student.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (role === "faculty" && facultyForm.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (role === "student" && !student.roll.trim()) {
      setError("Please enter your roll number.");
      return;
    }
    if (role === "faculty" && !facultyForm.regNo.trim()) {
      setError("Please enter your registration number.");
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
    const studentCustom = studentNewCourses
      .map((course) => ({
        title: course.title.trim(),
        code: course.code.trim(),
      }))
      .filter((course) => course.title || course.code);

    if (role === "student") {
      if (studentCustom.length === 0) {
        setError("Add at least one course.");
        return;
      }
      for (const course of studentCustom) {
        if (!course.title) {
          setError("Enter a course title.");
          return;
        }
        if (!course.code) {
          setError("Enter a course code for " + course.title + ".");
          return;
        }
      }
    }

    const customCourses = newCourses
      .map((course) => ({
        title: course.title.trim(),
        code: course.code.trim(),
      }))
      .filter((course) => course.title || course.code);

    if (role === "faculty") {
      if (existingCourses.length === 0 && customCourses.length === 0) {
        setError("Add at least one course you teach.");
        return;
      }
      for (const course of customCourses) {
        if (!course.title) {
          setError("Enter a course title.");
          return;
        }
        if (!course.code) {
          setError("Enter a course code for " + course.title + ".");
          return;
        }
      }
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
            regNo: facultyForm.regNo,
            username: facultyForm.username,
            password,
            courses: [
              ...existingCourses.map((key) => ({ title: key, code: "" })),
              ...customCourses,
            ],
            inviteCode: facultyForm.inviteCode,
          }
        : {
            role: "student",
            name: student.name,
            roll: student.roll,
            password,
            courses: studentCustom,
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
          ? "Enter your name, registration number and the courses you teach. Faculty registration requires the invite code from the administrator."
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

              <label>Your courses</label>
              <p className="muted" style={{ margin: "-6px 0 6px" }}>
                Add each course with its title and code:
              </p>
              {studentNewCourses.map((course, index) => (
                <div className="row" key={index}>
                  <div>
                    <label>Course title</label>
                    <input
                      placeholder="e.g. PHY"
                      value={course.title}
                      onChange={(e) => changeStudentNewCourse(index, "title", e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Course code</label>
                    <input
                      placeholder="e.g. 101"
                      value={course.code}
                      onChange={(e) => changeStudentNewCourse(index, "code", e.target.value)}
                    />
                  </div>
                  {studentNewCourses.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => removeStudentNewCourse(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-small" onClick={addStudentNewCourse}>
                + Add another course
              </button>
              <p className="muted" style={{ marginTop: 6 }}>
                You will only see doubts and submit questions for these courses.
              </p>
            </>
          ) : (
            <>
              <label>Full name</label>
              <input
                name="name"
                placeholder="e.g. Dr. Meera Joshi"
                autoComplete="name"
                value={facultyForm.name}
                onChange={changeFaculty}
              />

              <label>Registration / employee number</label>
              <input
                name="regNo"
                placeholder="e.g. FAC-1024"
                autoComplete="off"
                value={facultyForm.regNo}
                onChange={changeFaculty}
              />

              <label>Username (for login)</label>
              <input
                name="username"
                placeholder="Choose a username"
                autoComplete="username"
                value={facultyForm.username}
                onChange={changeFaculty}
              />

              <label>Courses you teach</label>
              {claimableCourses.length > 0 && (
                <>
                  <p className="muted" style={{ margin: "-6px 0 6px" }}>
                    Existing courses without a faculty member:
                  </p>
                  <div className="course-grid">
                    {claimableCourses.map((course) => (
                      <label className="check" key={course.key}>
                        <input
                          type="checkbox"
                          checked={existingCourses.includes(course.key)}
                          onChange={() => toggleExistingCourse(course.key)}
                        />
                        {course.key}
                      </label>
                    ))}
                  </div>
                </>
              )}

              <p className="muted" style={{ margin: "4px 0 6px" }}>
                Add a new course with its title and code:
              </p>
              {newCourses.map((course, index) => (
                <div className="row" key={index}>
                  <div>
                    <label>Course title</label>
                    <input
                      placeholder="e.g. INT"
                      value={course.title}
                      onChange={(e) => changeNewCourse(index, "title", e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Course code</label>
                    <input
                      placeholder="e.g. 305"
                      value={course.code}
                      onChange={(e) => changeNewCourse(index, "code", e.target.value)}
                    />
                  </div>
                  {newCourses.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => removeNewCourse(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-small" onClick={addNewCourse}>
                + Add another course
              </button>
              <p className="muted" style={{ marginTop: 6 }}>
                Student queries for these courses will be sent to you.
              </p>

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
