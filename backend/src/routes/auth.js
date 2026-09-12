import express from "express";
import { hashPassword, verifyPassword, signToken, isValidEmail, isValidPassword } from "../services/auth.js";
import { findUserByEmail, createUser } from "../db/db.js";

const router = express.Router();

// Dummy hash used so bcrypt always runs on login regardless of whether the
// email exists — prevents timing attacks that reveal registered email addresses.
const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!isValidEmail(email))
      return res.status(400).json({ error: "Please provide a valid email address." });
    if (!isValidPassword(password))
      return res.status(400).json({ error: "Password must be at least 8 characters." });

    const existing = await findUserByEmail(email);
    if (existing)
      return res.status(409).json({ error: "An account with this email already exists." });

    const user = await createUser({ email, passwordHash: hashPassword(password) });
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Error in /api/auth/signup:", err);
    res.status(500).json({ error: "Something went wrong creating your account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const user = await findUserByEmail(email);

    // BUG FIX 2: Always run bcrypt.compareSync regardless of whether the user
    // was found. Without this, timing differences reveal whether an email
    // is registered — a real security issue for an open-source project.
    const hashToCheck = user ? user.passwordHash : DUMMY_HASH;
    const passwordValid = verifyPassword(password, hashToCheck);

    if (!user || !passwordValid)
      return res.status(401).json({ error: "Incorrect email or password." });

    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Error in /api/auth/login:", err);
    res.status(500).json({ error: "Something went wrong logging you in." });
  }
});

export default router;
