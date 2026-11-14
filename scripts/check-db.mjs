#!/usr/bin/env node
// Check the MongoDB Atlas connection without starting the app.
//
//   npm run check:db

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { MongoClient } from "mongodb";

for (const file of [".env.local", ".env"]) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) continue;

  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "heard_in_class";

if (!uri) {
  console.error("MONGODB_URI is not set in .env.local or .env.");
  process.exit(1);
}

function target() {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/([^@]*)@([^/?]+)/);
  if (!match) return "unknown";

  const username = match[1].split(":")[0];
  return username + "@" + match[2];
}

console.log("Connecting to " + target() + " (database: " + dbName + ") ...");

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
});

try {
  await client.connect();
  const db = client.db(dbName);
  await db.command({ ping: 1 });

  const users = await db.collection("users").countDocuments();
  console.log("Connected successfully.");
  console.log("Database: " + dbName);
  console.log("User accounts: " + users);
  if (users === 0) {
    console.log("No accounts yet. Create a faculty account with:");
    console.log('  npm run users -- add --username sharma --password "strong-password" --role faculty --name "Dr. Sharma"');
  }
} catch (error) {
  console.error("Connection failed.");
  console.error(error.message);

  if (/bad auth|Authentication failed/i.test(error.message)) {
    console.error("");
    console.error("Atlas rejected the username/password. Fix it in Atlas:");
    console.error("  1. Open Atlas -> Database Access.");
    console.error("  2. Create the database user, or reset its password.");
    console.error("  3. Copy the connection string again from Connect -> Drivers.");
    console.error("  4. Update MONGODB_URI in .env.local and restart the dev server.");
    console.error("If the password has characters like @ : / ? # [ ] %, URL-encode them.");
  } else if (/ENOTFOUND|querySrv/i.test(error.message)) {
    console.error("The cluster hostname could not be resolved. Check the connection string / cluster status.");
  } else if (/Server selection timed out|ECONNREFUSED|ETIMEDOUT/i.test(error.message)) {
    console.error("Check Atlas -> Network Access and allow your current IP address.");
  }

  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
