import express from "express";
import { requireAuth } from "../services/auth.js";
import { getProfile, upsertProfile, getUserHistory, getScanById } from "../db/db.js";

const router = express.Router();
const VALID_SKIN_TYPES = ["normal","dry","oily","combination","sensitive","acne-prone"];
const VALID_ENVIRONMENTS = ["none","high-humidity","dry-arid","high-uv","pollution-heavy"];
// BUG FIX 4: concerns had no length cap or item sanitization.
// A malicious user could submit 10,000 concern strings and bloat the DB.
const MAX_CONCERNS = 15;
const MAX_CONCERN_LEN = 50;
const VALID_CONCERNS = new Set([
  "acne","sensitivity","hyperpigmentation","dryness","oiliness",
  "anti-aging","redness","dark-circles","large-pores","eczema","rosacea",
  "dehydration","uneven-tone","texture","sun-damage",
]);

router.get("/profile", requireAuth, async (req, res) => {
  const profile = await getProfile(req.userId);
  res.json({ profile });
});

router.put("/profile", requireAuth, async (req, res) => {
  try {
    const { skinType, environment, concerns } = req.body;
    if (skinType && !VALID_SKIN_TYPES.includes(skinType))
      return res.status(400).json({ error: `skinType must be one of: ${VALID_SKIN_TYPES.join(", ")}` });
    if (environment && !VALID_ENVIRONMENTS.includes(environment))
      return res.status(400).json({ error: `environment must be one of: ${VALID_ENVIRONMENTS.join(", ")}` });

    // Sanitize concerns: allowlist only, cap length, max items
    const sanitizedConcerns = Array.isArray(concerns)
      ? concerns
          .slice(0, MAX_CONCERNS)
          .map(c => String(c).toLowerCase().trim().slice(0, MAX_CONCERN_LEN))
          .filter(c => VALID_CONCERNS.has(c))
      : [];

    const updated = await upsertProfile(req.userId, {
      skinType: skinType || "normal",
      environment: environment || "none",
      concerns: sanitizedConcerns,
    });
    res.json({ profile: updated });
  } catch (err) {
    console.error("Error in PUT /api/profile:", err);
    res.status(500).json({ error: "Something went wrong saving your profile." });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  // BUG FIX 5: parseInt("abc") = NaN; NaN || 50 = 50 works but
  // parseInt("999999999") = 999999999 bypasses the Math.min cap.
  // Fix: use Number.isFinite guard.
  const rawLimit = parseInt(req.query.limit, 10);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50, 200);
  const history = await getUserHistory(req.userId, limit);
  res.json({ history });
});

router.get("/history/:id", requireAuth, async (req, res) => {
  const scan = await getScanById(req.params.id);
  if (!scan || scan.userId !== req.userId)
    return res.status(404).json({ error: "Scan not found." });
  res.json({ scan });
});

export default router;
