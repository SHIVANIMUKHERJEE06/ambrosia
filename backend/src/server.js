import "./env.js";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

import analyzeRoutes from "./routes/analyze.js";
import ocrRoutes from "./routes/ocr.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import compareRoutes from "./routes/compare.js";
import { loadMatcher, getDatasetMeta } from "./data/dataLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigin = process.env.FRONTEND_URL || "*";
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: "512kb" }));

// ── Rate limiters ─────────────────────────────────────────────
app.use("/api", rateLimit({
  windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment and try again." },
}));
app.use("/api/ocr", rateLimit({
  windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many photo uploads (limit: 10/min). Please wait." },
}));
app.use("/api/auth", rateLimit({
  windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many auth attempts. Please wait." },
}));
app.use("/api/compare", rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many comparisons. Please wait." },
}));

try {
  loadMatcher();
  const meta = getDatasetMeta();
  console.log(`[Ambrosia] Loaded ${meta.totalIngredients.toLocaleString()} ingredients, ${meta.flaggedIngredientCount} safety flags, ${meta.interactionWarningCount} interaction rules.`);
} catch (err) {
  console.error("[Ambrosia] FATAL:", err.message);
  process.exit(1);
}

if (!process.env.JWT_SECRET) console.warn("[Ambrosia] WARNING: JWT_SECRET not set — auth routes will fail.");
if (!process.env.GEMINI_API_KEY) {
  console.warn("[Ambrosia] INFO: GEMINI_API_KEY not set — both Gemini AI analysis AND photo OCR are disabled.");
  console.warn("[Ambrosia]       Get a free key at https://aistudio.google.com/app/apikey");
  console.warn("[Ambrosia]       Text-paste ingredient scanning works fully without it.");
}

app.get("/api/health", (req, res) => res.json({ status: "ok", dataset: getDatasetMeta() }));

app.use("/api", analyzeRoutes);
app.use("/api", ocrRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", compareRoutes);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(err.status || 500).json({ error: err.message || "An unexpected error occurred." });
});

app.listen(PORT, () => console.log(`[Ambrosia] Backend running on http://localhost:${PORT}`));
