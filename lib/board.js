import { getQueries } from "./db";
import { getCourses } from "./users";

// every public doubt from the courses a student is enrolled in (safe fields only)
export async function boardFor(user) {
  const courses = await getCourses(user.username);
  const queries = courses.length > 0 ? await getQueries({ course: { $in: courses } }) : [];

  return queries
    .filter((q) => courses.includes(q.course) && !q.private)
    .map((q) => ({
      // no name, no roll number of the asker
      id: q.id,
      course: q.course,
      category: q.category,
      question: q.question,
      status: q.status,
      answer: q.answer,
      createdAt: q.createdAt,
      mine: q.roll === user.roll,
      alsoCount: (q.alsoAsked || []).length,
      iHaveThis: (q.alsoAsked || []).some((a) => a.roll === user.roll),
      inSession: !!q.sessionId,
    }));
}
