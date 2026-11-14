#!/usr/bin/env node
// Manage application accounts in MongoDB Atlas.
//
//   npm run users -- add --username 101 --password "a-strong-password" \
//     --role student --name "Asha" --roll 101 --courses "INT:305,CSE326"
//
//   npm run users -- list
//   npm run users -- remove --username 101
//
// Passwords are hashed with scrypt before they are stored.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { MongoClient } from "mongodb";

// Load .env.local / .env without overriding variables already set by the shell.
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

const args = process.argv.slice(2);
const command = args[0];

function option(name) {
  const index = args.indexOf("--" + name);
  return index === -1 ? undefined : args[index + 1];
}

function hasFlag(name) {
  return args.includes("--" + name);
}

function fail(message) {
  console.error("Error: " + message);
  process.exit(1);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}

function courseKey(course) {
  if (typeof course === "string") return course.trim().replace(/\s+/g, " ");

  const title = typeof course?.title === "string" ? course.title.trim() : "";
  const code = typeof course?.code === "string" ? course.code.trim() : "";
  return [title, code].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

function courseLabels(user) {
  if (Array.isArray(user.courseKeys) && user.courseKeys.length > 0) {
    return user.courseKeys.join(", ");
  }

  const labels = (user.courses || [])
    .map((course) => courseKey(course))
    .filter(Boolean);

  return labels.length > 0 ? labels.join(", ") : "-";
}

async function connect() {
  if (!process.env.MONGODB_URI) {
    fail("MONGODB_URI is not set. Add it to .env.local or export it before running this script.");
  }

  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "heard_in_class");
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  return { client, db };
}

async function addUser() {
  const username = (option("username") || "").trim();
  const password = option("password") || "";
  const role = option("role");
  const name = (option("name") || "").trim();
  const update = hasFlag("update");

  if (!username) fail("--username is required.");
  if (password.length < 8) fail("--password is required and must be at least 8 characters.");
  if (role !== "student" && role !== "faculty") fail("--role must be either student or faculty.");
  if (!name) fail("--name is required.");

  // --courses "INT:305,CSE310" -> [{title:"INT", code:"305"}, {title:"CSE310", code:""}]
  const courseSpecs = (option("courses") || "")
    .split(",")
    .map((spec) => spec.trim())
    .filter(Boolean)
    .map((spec) => {
      const [title, ...rest] = spec.split(":");
      return { title: (title || "").trim(), code: rest.join(":").trim() };
    })
    .filter((course) => course.title || course.code);

  const courses = courseSpecs.map((course) =>
    [course.title, course.code].filter(Boolean).join(" ")
  );

  if (courses.length === 0) {
    fail(
      'Accounts need --courses (comma separated), for example: --courses "INT:305,CSE310"'
    );
  }

  const user = {
    username,
    passwordHash: hashPassword(password),
    role,
    name,
    courses,
  };

  if (role === "student") {
    user.roll = (option("roll") || username).trim();
  } else {
    user.regNo = (option("regno") || username).trim();
    // Faculty courses are stored as objects with a title and code. The script
    // accepts the full course key, e.g. --courses "INT 305,CSE310".
    user.courses = courseSpecs;
    user.courseKeys = courses;
  }

  const { client, db } = await connect();
  try {
    const users = db.collection("users");
    const existing = await users.findOne({ username });

    if (existing && !update) {
      fail('User "' + username + '" already exists. Add --update to replace its password and details.');
    }

    // A course belongs to one faculty member, so queries are never ambiguous.
    if (role === "faculty") {
      for (const course of courses) {
        const owner = await users.findOne({
          role: "faculty",
          $or: [{ courses: course }, { courseKeys: course }],
        });
        if (owner && owner.username !== username) {
          fail(
            course +
              ' is already assigned to "' +
              owner.name +
              '" (' +
              owner.username +
              "). Remove that account first if you want to move it."
          );
        }
      }

      const sameRegNo = await users.findOne({ role: "faculty", regNo: user.regNo });
      if (sameRegNo && sameRegNo.username !== username) {
        fail(
          'Registration number "' +
            user.regNo +
            '" is already used by "' +
            sameRegNo.name +
            '".'
        );
      }

      const sameName = await users.findOne({ role: "faculty", name });
      if (sameName && sameName.username !== username) {
        fail('A faculty account named "' + name + '" already exists.');
      }
    }

    if (existing) {
      await users.replaceOne({ username }, user);
      console.log("Updated " + role + ' account "' + username + '" (' + name + ").");
    } else {
      await users.insertOne(user);
      console.log("Created " + role + ' account "' + username + '" (' + name + ").");
    }
  } finally {
    await client.close();
  }
}

async function listUsers() {
  const { client, db } = await connect();
  try {
    const users = await db
      .collection("users")
      .find({}, { projection: { _id: 0, passwordHash: 0 } })
      .sort({ role: 1, username: 1 })
      .toArray();

    if (users.length === 0) {
      console.log("No accounts yet. Create one with: npm run users -- add ...");
      return;
    }

    for (const user of users) {
      const extra =
        user.role === "student"
          ? "roll " + user.roll + ", courses " + courseLabels(user)
          : "reg no " + (user.regNo || "-") + ", courses " + courseLabels(user);
      console.log(user.role.padEnd(8) + user.username.padEnd(16) + user.name + "  (" + extra + ")");
    }
  } finally {
    await client.close();
  }
}

async function removeUser() {
  const username = (option("username") || "").trim();
  if (!username) fail("--username is required.");

  const { client, db } = await connect();
  try {
    const result = await db.collection("users").deleteOne({ username });
    await db.collection("authSessions").deleteMany({ username });

    if (result.deletedCount === 0) {
      console.log('No account named "' + username + '" was found.');
    } else {
      console.log('Removed account "' + username + '" and ended its active sessions.');
    }
  } finally {
    await client.close();
  }
}

async function main() {
  if (command === "add") await addUser();
  else if (command === "list") await listUsers();
  else if (command === "remove") await removeUser();
  else {
    console.log(
      [
        "Usage:",
        '  npm run users -- add --username <name> --password <password> --role <student|faculty> --name <full name> --courses "INT:305,CSE310" [--roll <roll>] [--regno <number>] [--update]',
        "  npm run users -- list",
        "  npm run users -- remove --username <name>",
      ].join("\n")
    );
  }
}

main().catch((error) => fail(error.message));
