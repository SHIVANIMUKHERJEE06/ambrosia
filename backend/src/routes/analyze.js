// analyze.js
import express from "express";
import { IngredientMatcher } from "../services/matcher.js";
import { scoreProduct, checkInteractions } from "../services/scoring.js";
import { generateAlternativeGuidance } from "../services/alternatives.js";
import { analyzeWithGemini } from "../services/gemini.js";
import { loadMatcher, getSafetyData, getDatasetMeta } from "../data/dataLoader.js";
import { optionalAuth } from "../services/auth.js";
import { saveScanResult } from "../db/db.js";

const router = express.Router();

// ── Input limits (Issue 4) ────────────────────────────────────────────────────
const MAX_PRODUCT_NAME = 200;
const MAX_INGREDIENT_TEXT = 8000;
const MAX_TOKEN_COUNT = 80;

router.post("/analyze", optionalAuth, async (req, res) => {
  try {
    let { ingredientText, productName, skinType, environment, save } = req.body;

    // Validate + sanitize inputs
    if (!ingredientText || typeof ingredientText !== "string" || !ingredientText.trim()) {
      return res.status(400).json({ error: "ingredientText is required. Paste the ingredient list from the product label." });
    }
    if (ingredientText.length > MAX_INGREDIENT_TEXT) {
      return res.status(400).json({ error: `Ingredient text is too long (max ${MAX_INGREDIENT_TEXT} characters). A typical product label is under 1000 characters.` });
    }
    if (productName && typeof productName === "string") {
      productName = productName.slice(0, MAX_PRODUCT_NAME).trim();
    } else {
      productName = null;
    }

    const matcher = loadMatcher();
    const safetyData = getSafetyData();
    const tokens = IngredientMatcher.parseIngredientListString(ingredientText);

    if (tokens.length === 0) {
      return res.status(400).json({ error: "Could not find any ingredients. Make sure it's a comma-separated ingredient list." });
    }
    if (tokens.length > MAX_TOKEN_COUNT) {
      return res.status(400).json({ error: `Too many ingredients parsed (${tokens.length}). Max is ${MAX_TOKEN_COUNT}. Check that the text is a comma-separated ingredient list, not a full product page.` });
    }

    const resolvedList = matcher.resolveIngredientList(tokens);
    const scoreResult = scoreProduct(resolvedList, { skinType, environment }, safetyData.interactionWarnings);
    const alternativeGuidance = generateAlternativeGuidance(resolvedList, skinType);

    // Gemini AI analysis for unrecognized ingredients (Issue — new feature)
    let geminiInsights = null;
    const unrecognizedNames = resolvedList.ingredients
      .filter(i => !i.recognized)
      .map(i => i.rawInput);

    if (unrecognizedNames.length > 0 && process.env.GEMINI_API_KEY) {
      try {
        geminiInsights = await analyzeWithGemini(unrecognizedNames, skinType);
      } catch (err) {
        // Gemini is best-effort — never fail the whole scan if AI is down
        console.warn("[Ambrosia] Gemini analysis failed (non-fatal):", err.message);
      }
    }

    const responseBody = {
      productName,
      coverage: resolvedList.coverage,
      ingredients: resolvedList.ingredients,
      score: scoreResult,
      alternativeGuidance,
      geminiInsights,
      datasetInfo: getDatasetMeta(),
    };

    if (save) {
      const saved = await saveScanResult({
        userId: req.userId || null,
        productName,
        rawIngredientText: ingredientText,
        scoreResult,
      });
      responseBody.scanId = saved.id;
    }

    res.json(responseBody);
  } catch (err) {
    console.error("Error in /api/analyze:", err);
    res.status(500).json({ error: "Something went wrong analyzing this product. Please try again." });
  }
});

router.post("/interactions", async (req, res) => {
  try {
    const { ingredientTextA, ingredientTextB } = req.body;
    if (!ingredientTextA || !ingredientTextB) {
      return res.status(400).json({ error: "Both ingredientTextA and ingredientTextB are required." });
    }
    if (ingredientTextA.length > MAX_INGREDIENT_TEXT || ingredientTextB.length > MAX_INGREDIENT_TEXT) {
      return res.status(400).json({ error: "Ingredient text too long (max 8000 chars each)." });
    }

    const matcher = loadMatcher();
    const safetyData = getSafetyData();

    const resolvedA = matcher.resolveIngredientList(IngredientMatcher.parseIngredientListString(ingredientTextA));
    const resolvedB = matcher.resolveIngredientList(IngredientMatcher.parseIngredientListString(ingredientTextB));
    const warnings = checkInteractions(resolvedA, resolvedB, safetyData.interactionWarnings);

    res.json({ warnings, coverageA: resolvedA.coverage, coverageB: resolvedB.coverage });
  } catch (err) {
    console.error("Error in /api/interactions:", err);
    res.status(500).json({ error: "Something went wrong checking interactions. Please try again." });
  }
});

router.get("/dataset-info", (req, res) => {
  res.json(getDatasetMeta());
});

export default router;
