import { getDb } from "./mongodb";

// All collections live in MongoDB Atlas.
// Reads never expose Mongo's internal _id field to the app or the API.

const NO_ID = { projection: { _id: 0 } };

async function collection(name) {
  const db = await getDb();
  return db.collection(name);
}

/* ------------------------------- queries ------------------------------- */

export async function getQueries(filter = {}) {
  const queries = await collection("queries");
  return queries.find(filter, NO_ID).toArray();
}

export async function getQuery(id) {
  const queries = await collection("queries");
  return queries.findOne({ id }, NO_ID);
}

export async function insertQuery(query) {
  const queries = await collection("queries");
  await queries.insertOne({ ...query });
  return query;
}

export async function updateQuery(id, patch) {
  const queries = await collection("queries");
  await queries.updateOne({ id }, { $set: patch });
  return getQuery(id);
}

export async function updateQueriesWhere(filter, patch) {
  const queries = await collection("queries");
  return queries.updateMany(filter, { $set: patch });
}

/* ------------------------------- sessions ------------------------------ */

export async function getSessions(filter = {}) {
  const sessions = await collection("sessions");
  return sessions.find(filter, NO_ID).toArray();
}

export async function getSession(id) {
  const sessions = await collection("sessions");
  return sessions.findOne({ id }, NO_ID);
}

export async function insertSession(session) {
  const sessions = await collection("sessions");
  await sessions.insertOne({ ...session });
  return session;
}

export async function updateSession(id, patch) {
  const sessions = await collection("sessions");
  await sessions.updateOne({ id }, { $set: patch });
  return getSession(id);
}

/* -------------------------------- courses ------------------------------ */

export async function getCourseCatalog() {
  const courses = await collection("courses");
  return courses.find({}, NO_ID).toArray();
}

// Creates a course if it does not exist, and optionally records the faculty
// member who teaches it. Used by both student and faculty signup.
export async function upsertCourse(course) {
  const courses = await collection("courses");

  const set = {};
  if (course.facultyName !== undefined) set.facultyName = course.facultyName;
  if (course.facultyUsername !== undefined) set.facultyUsername = course.facultyUsername;

  const update = {
    $setOnInsert: {
      key: course.key,
      title: course.title || course.key,
      code: course.code || "",
      createdBy: course.createdBy || "unknown",
      createdAt: new Date().toISOString(),
    },
  };
  if (Object.keys(set).length > 0) update.$set = set;

  await courses.updateOne({ key: course.key }, update, { upsert: true });
}

/* -------------------------------- users -------------------------------- */

export async function getUsers() {
  const users = await collection("users");
  return users.find({}, NO_ID).toArray();
}

export async function findUser(username) {
  const users = await collection("users");
  return users.findOne({ username }, NO_ID);
}

export async function findFacultyByName(name) {
  const users = await collection("users");
  return users.findOne({ role: "faculty", name }, NO_ID);
}

export async function findFacultyByRegNo(regNo) {
  if (!regNo) return null;
  const users = await collection("users");
  return users.findOne({ role: "faculty", regNo }, NO_ID);
}

// all faculty accounts, used to show which courses are already taken at signup
export async function getFaculties() {
  const users = await collection("users");
  return users.find({ role: "faculty" }, NO_ID).toArray();
}

// the faculty account that owns a course (database accounts win over the
// defaults in lib/triage.js). Supports old string courses and new
// { title, code } courses stored with a courseKeys lookup array.
export async function findFacultyByCourse(course) {
  const key = typeof course === "string" ? course.trim() : "";
  if (!key) return null;

  const users = await collection("users");
  return users.findOne(
    { role: "faculty", $or: [{ courses: key }, { courseKeys: key }] },
    NO_ID
  );
}

export async function insertUser(user) {
  const users = await collection("users");
  await users.insertOne({ ...user });
  return user;
}

export async function countUsers() {
  const users = await collection("users");
  return users.countDocuments();
}

/* ---------------------------- login sessions --------------------------- */

export async function createAuthSession({ sid, username, exp }) {
  const sessions = await collection("authSessions");
  await sessions.insertOne({ _id: sid, username, exp });
}

export async function isAuthSessionAlive(sid) {
  const sessions = await collection("authSessions");
  const session = await sessions.findOne({ _id: sid, exp: { $gt: Date.now() } });
  return Boolean(session);
}

export async function deleteAuthSession(sid) {
  const sessions = await collection("authSessions");
  await sessions.deleteOne({ _id: sid });
}

export async function deleteExpiredAuthSessions() {
  const sessions = await collection("authSessions");
  await sessions.deleteMany({ exp: { $lte: Date.now() } });
}

/* ----------------------------- embeddings ------------------------------ */

export async function getEmbeddings(ids = []) {
  if (ids.length === 0) return {};

  const embeddings = await collection("embeddings");
  const docs = await embeddings.find({ _id: { $in: ids } }).toArray();

  return Object.fromEntries(docs.map((doc) => [doc._id, { model: doc.model, v: doc.v }]));
}

export async function saveEmbeddings(entries = []) {
  if (entries.length === 0) return;

  const embeddings = await collection("embeddings");
  await embeddings.bulkWrite(
    entries.map((entry) => ({
      replaceOne: {
        filter: { _id: entry.id },
        replacement: { _id: entry.id, model: entry.model, v: entry.v },
        upsert: true,
      },
    }))
  );
}
