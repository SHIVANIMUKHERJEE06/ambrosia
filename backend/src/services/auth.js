// auth.js
//
// Minimal email/password auth so scan history and skin profiles can
// actually persist per-person (fixes loophole #5 alongside db.js).
// Deliberately simple: no email verification, no OAuth, no password
// reset flow — those are documented as "next steps" in the README
// rather than half-built here, per the project's own honesty principle.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// NOTE: JWT_SECRET is read lazily (inside functions), not captured as a
// module-level constant at import time. This file can be imported by
// server.js before dotenv.config() has run, and a module-level constant
// would freeze in `undefined` permanently even after dotenv loads it.
function getJwtSecret() {
  return process.env.JWT_SECRET;
}

const TOKEN_EXPIRY = "30d";

export function hashPassword(plainPassword) {
  return bcrypt.hashSync(plainPassword, 10);
}

export function verifyPassword(plainPassword, hash) {
  return bcrypt.compareSync(plainPassword, hash);
}

export function signToken(user) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set in the backend .env file. See the deployment guide."
    );
  }
  return jwt.sign({ sub: user.id, email: user.email }, secret, {
    expiresIn: TOKEN_EXPIRY,
  });
}

export function verifyToken(token) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error("JWT_SECRET is not set in the backend .env file.");
  }
  return jwt.verify(token, secret);
}

/** Express middleware: attaches req.userId if a valid Bearer token is present, otherwise leaves it undefined (does not block the request — many routes work anonymously). */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      const payload = verifyToken(header.slice(7));
      req.userId = payload.sub;
      req.userEmail = payload.email;
    } catch {
      // Invalid/expired token on an optional-auth route: proceed anonymously
      // rather than blocking, since not every feature requires login.
    }
  }
  next();
}

/** Express middleware: requires a valid Bearer token, 401s otherwise. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required." });
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email);
}

export function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}
