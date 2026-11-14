import crypto from "crypto";
import { NextResponse } from "next/server";
import { courseKey } from "@/lib/courses";
import { courseFaculty } from "@/lib/triage";
import {
  findFacultyByCourse,
  findFacultyByName,
  findFacultyByRegNo,
  findUser,
  insertUser,
  updateQueriesWhere,
  upsertCourse,
} from "@/lib/db";
import { hashPassword } from "@/lib/users";
import { startSession, setSessionCookie } from "@/lib/auth";

const USERNAME_PATTERN = /^[A-Za-z0-9._/-]{1,40}$/;
const REGNO_PATTERN = /^[A-Za-z0-9._/-]{1,40}$/;
const COURSE_TITLE_PATTERN = /^[A-Za-z0-9 ._&()+/,-]{1,60}$/;
const COURSE_CODE_PATTERN = /^[A-Za-z0-9._/-]{1,20}$/;

// Courses come from the signup form as { title, code } pairs. Old string
// courses are still accepted so existing API clients keep working.
function parseCourses(input) {
  if (!Array.isArray(input)) {
    return { error: "Select or add at least one course." };
  }

  const courses = [];
  const keys = [];

  for (const raw of input) {
    let title = "";
    let code = "";

    if (typeof raw === "string") {
      title = raw.trim();
    } else if (raw && typeof raw === "object") {
      title = typeof raw.title === "string" ? raw.title.trim() : "";
      code = typeof raw.code === "string" ? raw.code.trim() : "";
    }

    if (!title && !code) continue; // ignore an empty row

    if (!title) {
      return { error: "Enter a course title." };
    }
    if (!COURSE_TITLE_PATTERN.test(title)) {
      return {
        error:
          "Course title may only contain letters, numbers, spaces and simple punctuation (max 60).",
      };
    }
    if (code && !COURSE_CODE_PATTERN.test(code)) {
      return {
        error:
          "Course code may only contain letters, numbers, dots, dashes, underscores or slashes (max 20).",
      };
    }

    const key = courseKey({ title, code });
    if (keys.includes(key)) {
      return { error: "The course " + key + " was added more than once." };
    }

    keys.push(key);
    courses.push({ title, code });
  }

  if (courses.length === 0) {
    return { error: "Select or add at least one course." };
  }

  return { courses, keys };
}

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

// Save the courses on the shared catalog after the account is created. Faculty
// courses also take over any queries that were waiting without a faculty owner.
async function registerCourses(user, courseEntries) {
  for (const entry of courseEntries) {
    const key = courseKey(entry);

    if (user.role === "faculty") {
      await upsertCourse({
        key,
        title: entry.title,
        code: entry.code,
        createdBy: "faculty",
        facultyName: user.name,
        facultyUsername: user.username,
      });

      const fallback = courseFaculty[key];
      const reassignFrom = fallback ? ["Unassigned", fallback] : ["Unassigned"];
      await updateQueriesWhere(
        { course: key, assignedTo: { $in: reassignFrom } },
        { assignedTo: user.name }
      );
    } else {
      // a student may study a course no faculty account teaches yet
      await upsertCourse({
        key,
        title: entry.title,
        code: entry.code,
        createdBy: "student",
      });
    }
  }
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

  const created =
    role === "faculty"
      ? await createFaculty(body, name, password)
      : await createStudent(body, name, password);

  if (created.error) {
    return NextResponse.json({ error: created.error.error }, { status: created.error.status });
  }

  const { user, courseEntries } = created;

  try {
    await insertUser(user);
  } catch (error) {
    // unique index on users.username -> register the same username a moment earlier
    if (error && error.code === 11000) {
      return NextResponse.json({ error: "This username is already taken." }, { status: 409 });
    }
    throw error;
  }

  await registerCourses(user, courseEntries);

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
  const parsed = parseCourses(body.courses);
  if (parsed.error) {
    return { error: { error: parsed.error, status: 400 } };
  }

  const { courses: courseEntries, keys: courses } = parsed;

  if (!USERNAME_PATTERN.test(roll)) {
    return {
      error: {
        error: "Roll number may only contain letters, numbers, dots, dashes, underscores or slashes (max 40).",
        status: 400,
      },
    };
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
    user: {
      username: roll,
      passwordHash: hashPassword(password),
      role: "student",
      name,
      roll,
      courses,
    },
    courseEntries,
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

  const regNo = typeof body.regNo === "string" ? body.regNo.trim() : "";
  if (!REGNO_PATTERN.test(regNo)) {
    return {
      error: {
        error: "Registration number may only contain letters, numbers, dots, dashes, underscores or slashes (max 40).",
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

  // A faculty member creates the courses they teach; those courses route to them.
  const parsed = parseCourses(body.courses);
  if (parsed.error) {
    return { error: { error: parsed.error, status: 400 } };
  }
  const { courses: courseEntries, keys: courseKeys } = parsed;

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
  if (await findFacultyByRegNo(regNo)) {
    return {
      error: {
        error: "This registration number is already registered. Try logging in instead.",
        status: 409,
      },
    };
  }

  // Each course has one faculty member. The database is checked first so a new
  // faculty can claim a course that only exists in the defaults.
  for (const key of courseKeys) {
    const owner = await findFacultyByCourse(key);
    if (owner) {
      return {
        error: {
          error: key + " is already assigned to " + owner.name + ". Choose another course.",
          status: 409,
        },
      };
    }
  }

  return {
    user: {
      username,
      passwordHash: hashPassword(password),
      role: "faculty",
      name,
      regNo,
      courses: courseEntries,
      courseKeys,
    },
    courseEntries,
  };
}
