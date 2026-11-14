import { courseFaculty } from "./triage";
import { getCourseCatalog, getFaculties } from "./db";

// A course has a title (e.g. "INT") and a code (e.g. "305"). They are stored
// together as one key, which is what students pick and queries are saved with.
export function courseKey(course) {
  if (typeof course === "string") {
    return course.trim().replace(/\s+/g, " ");
  }

  const title = typeof course?.title === "string" ? course.title.trim() : "";
  const code = typeof course?.code === "string" ? course.code.trim() : "";
  return [title, code].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

// Accepts both old string courses ("CSE310") and new { title, code } objects.
export function normalizeCourseList(list) {
  if (!Array.isArray(list)) return [];

  return list
    .map((course) => {
      if (typeof course === "string") {
        const key = courseKey(course);
        return key ? { key, title: key, code: "" } : null;
      }

      const title = typeof course?.title === "string" ? course.title.trim() : "";
      const code = typeof course?.code === "string" ? course.code.trim() : "";
      const key = courseKey({ title, code });
      return key ? { key, title, code } : null;
    })
    .filter(Boolean);
}

export function facultyCourseKeys(faculty) {
  const keys = normalizeCourseList(faculty?.courses).map((course) => course.key);

  if (Array.isArray(faculty?.courseKeys)) {
    for (const key of faculty.courseKeys) {
      const clean = courseKey(key);
      if (clean) keys.push(clean);
    }
  }

  return [...new Set(keys)];
}

// Every course a student can choose: the built-in defaults in lib/triage.js,
// courses created by any signup, and the courses on registered faculty accounts.
export async function getAvailableCourses() {
  const byKey = new Map();

  for (const [key, facultyName] of Object.entries(courseFaculty)) {
    byKey.set(key, {
      key,
      title: key,
      code: "",
      facultyName,
      builtIn: true,
      claimable: true,
    });
  }

  // Courses saved in the catalog (created by a student or a faculty member).
  for (const course of await getCourseCatalog()) {
    const key = courseKey(course.key);
    if (!key) continue;

    const facultyName = course.facultyName || null;
    byKey.set(key, {
      key,
      title: course.title || key,
      code: course.code || "",
      facultyName,
      builtIn: false,
      claimable: !facultyName,
    });
  }

  // Faculty accounts are authoritative for the courses they teach.
  for (const faculty of await getFaculties()) {
    for (const course of normalizeCourseList(faculty.courses)) {
      byKey.set(course.key, {
        key: course.key,
        title: course.title,
        code: course.code,
        facultyName: faculty.name,
        builtIn: false,
        claimable: false,
      });
    }

    for (const key of facultyCourseKeys(faculty)) {
      const existing = byKey.get(key);
      byKey.set(key, {
        key,
        title: existing?.title || key,
        code: existing?.code || "",
        facultyName: faculty.name,
        builtIn: false,
        claimable: false,
      });
    }
  }

  return [...byKey.values()];
}
