import crypto from "crypto";
import { NextResponse } from "next/server";
import { courseFaculty } from "@/lib/triage";
import { findFacultyByName, findUser, insertUser } from "@/lib/db";
import { hashPassword } from "@/lib/users";
import { startSession, setSessionCookie } from "@/lib/auth";

const USERNAME_PATTERN = /^[A-Za-z0-9._/-]{1,40}$/;

function sameSecret(a, b) {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

function validatePassword(password) {
  if (password.length < 8 || password.length > 200) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

// POST /api/signup
// role "student" -> self-registration (can be closed with ALLOW_STUDENT_SIGNUP=false)
// role "faculty" -> allowed only with FACULTY_INVITE_CODE
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const role = body.role === "faculty" ? "faculty" : "student";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const user =
    role === "faculty"
      ? await createFaculty(body, name, password)
      : await createStudent(body, name, password);

  if (user.error) {
    return NextResponse.json({ error: user.error.error }, { status: user.error.status });
  }

  try {
    await insertUser(user);
  } catch (error) {
    // unique index on users.username -> register the same username a moment earlier
    if (error && error.code === 11000) {
      return NextResponse.json({ error: "This username is already taken." }, { status: 409 });
    }
    throw error;
  }

  // log the new user in straight away
  const res = NextResponse.json({ role: user.role, name: user.name }, { status: 201 });
  setSessionCookie(res, await startSession(user));
  return res;
}

async function createStudent(body, name, password) {
  if (process.env.ALLOW_STUDENT_SIGNUP === "false") {
    return { error: { error: "Student signup is currently disabled.", status: 403 } };
  }

  const roll = typeof body.roll === "string" ? body.roll.trim() : "";
  const requestedCourses = Array.isArray(body.courses)
    ? body.courses.filter((course) => typeof course === "string")
    : [];
  const courses = [...new Set(requestedCourses)];
  const validCourses = Object.keys(courseFaculty);

  if (!USERNAME_PATTERN.test(roll)) {
    return {
      error: {
        error: "Roll number may only contain letters, numbers, dots, dashes, underscores or slashes (max 40).",
        status: 400,
      },
    };
  }
  if (courses.length === 0) {
    return { error: { error: "Select at least one course.", status: 400 } };
  }
  if (courses.some((course) => !validCourses.includes(course))) {
    return { error: { error: "One or more selected courses are not available.", status: 400 } };
  }
  if (await findUser(roll)) {
    return {
      error: {
        error: "An account with this roll number already exists. Try logging in.",
        status: 409,
      },
    };
  }

  return {
    username: roll,
    passwordHash: hashPassword(password),
    role: "student",
    name,
    roll,
    courses,
  };
}

async function createFaculty(body, name, password) {
  const inviteCode = (process.env.FACULTY_INVITE_CODE || "").trim();
  if (!inviteCode) {
    return {
      error: { error: "Faculty signup is not configured. Ask the administrator for an account.", status: 403 },
    };
  }

  const suppliedCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
  if (!suppliedCode) {
    return { error: { error: "Faculty invite code is required.", status: 400 } };
  }
  if (!sameSecret(suppliedCode, inviteCode)) {
    return { error: { error: "Invalid faculty invite code.", status: 403 } };
  }

  const facultyNames = [...new Set(Object.values(courseFaculty))];
  if (!facultyNames.includes(name)) {
    return {
      error: {
        error: "Choose your faculty name from the list. Ask the administrator if your name is missing.",
        status: 400,
      },
    };
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!USERNAME_PATTERN.test(username)) {
    return {
      error: {
        error: "Username may only contain letters, numbers, dots, dashes, underscores or slashes (max 40).",
        status: 400,
      },
    };
  }
  if (await findUser(username)) {
    return { error: { error: "This username is already taken.", status: 409 } };
  }
  if (await findFacultyByName(name)) {
    return {
      error: {
        error: "A faculty account for " + name + " already exists. Please log in instead.",
        status: 409,
      },
    };
  }

  const courses = Object.keys(courseFaculty).filter((course) => courseFaculty[course] === name);

  return {
    username,
    passwordHash: hashPassword(password),
    role: "faculty",
    name,
    courses,
  };
}
