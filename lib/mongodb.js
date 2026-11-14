import { MongoClient } from "mongodb";

// The connection string is read from MONGODB_URI (MongoDB Atlas).
// Example:
//   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
const DEFAULT_DB = "heard_in_class";

function connectionString() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add your MongoDB Atlas connection string to the environment (see .env.example)."
    );
  }
  return uri;
}

// Reuse one connection pool across hot reloads and serverless invocations.
const globalForMongo = globalThis;

function getClient() {
  if (!globalForMongo.__p09MongoClientPromise) {
    const client = new MongoClient(connectionString(), {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      retryWrites: true,
    });

    globalForMongo.__p09MongoClientPromise = client.connect().catch((err) => {
      // A failed connection must not be cached forever.
      globalForMongo.__p09MongoClientPromise = undefined;
      throw err;
    });
  }

  return globalForMongo.__p09MongoClientPromise;
}

let indexesReady;

function ensureIndexes(db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      db.collection("users").createIndex({ username: 1 }, { unique: true }),
      db.collection("courses").createIndex({ key: 1 }, { unique: true }),
      db.collection("queries").createIndex({ id: 1 }, { unique: true }),
      db.collection("queries").createIndex({ roll: 1, createdAt: -1 }),
      db.collection("queries").createIndex({ assignedTo: 1, createdAt: -1 }),
      db.collection("sessions").createIndex({ id: 1 }, { unique: true }),
      db.collection("authSessions").createIndex({ exp: 1 }),
    ]).catch((err) => {
      indexesReady = undefined;
      throw err;
    });
  }

  return indexesReady;
}

export async function getDb() {
  const client = await getClient();
  const db = client.db(process.env.MONGODB_DB || DEFAULT_DB);
  await ensureIndexes(db);
  return db;
}
