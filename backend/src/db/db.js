// db.js
//
// Fixes loophole #5 from the critique:
// "No persistence, no auth, no history. Scan a product, refresh, it's
//  gone. For a tool whose entire pitch is 'track what's safe for your
//  skin,' having zero memory between sessions undercuts the premise."
//
// Uses lowdb (pure JS, JSON-file backed) instead of better-sqlite3 or
// another native-binding database. This is a deliberate choice for a
// beginner-maintained, free-tier-hosted open-source project:
//   - Zero native compilation step (works on any free host out of the box)
//   - Human-readable data file (easy to inspect/debug as a beginner)
//   - Good enough for hackathon/demo scale; the README documents the
//     migration path to Postgres for real production scale.

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "..", "data-store", "db.json");

const defaultData = {
  users: [], // { id, email, passwordHash, createdAt }
  profiles: [], // { userId, skinType, environment, concerns: [], updatedAt }
  scanHistory: [], // { id, userId|null, productName, rawIngredientText, scoreResult, createdAt }
};

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  const adapter = new JSONFile(DB_PATH);
  const db = new Low(adapter, defaultData);
  await db.read();
  db.data ||= structuredClone(defaultData);
  // Ensure all top-level keys exist even if the file predates a schema change
  for (const key of Object.keys(defaultData)) {
    if (!(key in db.data)) db.data[key] = structuredClone(defaultData[key]);
  }
  await db.write();
  dbInstance = db;
  return db;
}

export function newId() {
  return crypto.randomUUID();
}

// --- User helpers ---

export async function findUserByEmail(email) {
  const db = await getDb();
  return db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function createUser({ email, passwordHash }) {
  const db = await getDb();
  const user = {
    id: newId(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  db.data.users.push(user);
  await db.write();
  return user;
}

// --- Profile helpers ---

export async function getProfile(userId) {
  const db = await getDb();
  return db.data.profiles.find((p) => p.userId === userId) || null;
}

export async function upsertProfile(userId, profileData) {
  const db = await getDb();
  const existing = db.data.profiles.find((p) => p.userId === userId);
  const updated = {
    userId,
    skinType: profileData.skinType,
    environment: profileData.environment,
    concerns: profileData.concerns || [],
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    Object.assign(existing, updated);
  } else {
    db.data.profiles.push(updated);
  }
  await db.write();
  return updated;
}

// --- Scan history helpers ---

export async function saveScanResult({ userId, productName, rawIngredientText, scoreResult }) {
  const db = await getDb();
  const entry = {
    id: newId(),
    userId: userId || null,
    productName: productName || "Unnamed product",
    rawIngredientText,
    scoreResult,
    createdAt: new Date().toISOString(),
  };
  db.data.scanHistory.push(entry);

  // BUG FIX 8: Previous cap was global (2000 total) which could delete
  // OTHER users' scans when one user is prolific. Fix: cap per-user to
  // 100 scans (keeps the most recent), then apply a global safety net of
  // 5000 to prevent the file growing unbounded on a free-tier host.
  if (userId) {
    const userScans = db.data.scanHistory.filter(s => s.userId === userId);
    if (userScans.length > 100) {
      // Remove the oldest scans for this specific user only
      const toRemove = userScans
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(0, userScans.length - 100)
        .map(s => s.id);
      db.data.scanHistory = db.data.scanHistory.filter(s => !toRemove.includes(s.id));
    }
  }
  // Global safety net
  if (db.data.scanHistory.length > 5000) {
    db.data.scanHistory = db.data.scanHistory.slice(-5000);
  }
  await db.write();
  return entry;
}

export async function getUserHistory(userId, limit = 50) {
  const db = await getDb();
  return db.data.scanHistory
    .filter((s) => s.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

export async function getScanById(id) {
  const db = await getDb();
  return db.data.scanHistory.find((s) => s.id === id) || null;
}
