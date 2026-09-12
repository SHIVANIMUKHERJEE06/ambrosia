// compare.js — Product comparison route
// Also integrates Open Beauty Facts API (world.openbeautyfacts.org)
// Open Beauty Facts: free, open-source, 2M+ products, updated daily
// Replaces the Nykaa/Tira limitation with a real public database

import express from "express";
import { IngredientMatcher } from "../services/matcher.js";
import { scoreProduct } from "../services/scoring.js";
import { generateAlternativeGuidance } from "../services/alternatives.js";
import { loadMatcher, getSafetyData, getDatasetMeta } from "../data/dataLoader.js";

const router = express.Router();
const MAX_PRODUCTS = 3;
const MAX_INGREDIENT_TEXT = 8000;

/**
 * POST /api/compare
 * Body: { products: [{name, ingredientText}], skinType, environment }
 * Returns side-by-side analysis of 2-3 products for comparison.
 */
router.post("/compare", async (req, res) => {
  try {
    const { products, skinType, environment } = req.body;

    if (!Array.isArray(products) || products.length < 2) {
      return res.status(400).json({ error: "Provide at least 2 products to compare." });
    }
    if (products.length > MAX_PRODUCTS) {
      return res.status(400).json({ error: `Maximum ${MAX_PRODUCTS} products per comparison.` });
    }

    for (const p of products) {
      if (!p.ingredientText || typeof p.ingredientText !== "string" || !p.ingredientText.trim()) {
        return res.status(400).json({ error: `Product "${p.name || "unnamed"}" is missing an ingredient list.` });
      }
      if (p.ingredientText.length > MAX_INGREDIENT_TEXT) {
        return res.status(400).json({ error: `Ingredient list for "${p.name}" is too long.` });
      }
    }

    const matcher = loadMatcher();
    const safetyData = getSafetyData();

    const results = products.map((product) => {
      const tokens = IngredientMatcher.parseIngredientListString(product.ingredientText);
      const resolvedList = matcher.resolveIngredientList(tokens);
      const scoreResult = scoreProduct(resolvedList, { skinType, environment }, safetyData.interactionWarnings);
      const alternatives = generateAlternativeGuidance(resolvedList, skinType);

      // Summarize top concerns for comparison view
      const topConcerns = resolvedList.ingredients
        .filter(i => i.safetyFlag)
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.safetyFlag.severity] - order[b.safetyFlag.severity];
        })
        .slice(0, 4)
        .map(i => ({
          name: i.rawInput,
          severity: i.safetyFlag.severity,
          category: i.safetyFlag.category,
          reason: i.safetyFlag.reason,
        }));

      const highlights = [];
      // Positive highlights
      const goodIngredients = ["niacinamide", "hyaluronic acid", "sodium hyaluronate", "vitamin c", "ascorbic acid", "retinol", "squalane", "ceramide", "panthenol", "allantoin", "centella asiatica"];
      const foundGood = resolvedList.ingredients
        .filter(i => i.recognized && goodIngredients.some(g => (i.resolvedInci || "").toLowerCase().includes(g)))
        .slice(0, 3)
        .map(i => i.resolvedInci || i.rawInput);
      if (foundGood.length) highlights.push(`Contains: ${foundGood.join(", ")}`);

      return {
        name: (product.name || "Product").slice(0, 200),
        score: scoreResult.score,
        confidence: scoreResult.confidence,
        verdict: scoreResult.verdict,
        coverage: resolvedList.coverage,
        skinType: scoreResult.skinType,
        capApplied: scoreResult.capApplied,
        topConcerns,
        highlights,
        selfInteractionWarnings: scoreResult.selfInteractionWarnings || [],
        totalFlagged: resolvedList.ingredients.filter(i => i.safetyFlag).length,
        totalIngredients: resolvedList.coverage.total,
        alternativeSuggestions: alternatives.suggestions.length,
      };
    });

    // Rank products by score
    const ranked = [...results].sort((a, b) => b.score - a.score);
    const winner = ranked[0];

    res.json({
      results,
      ranked,
      winner: winner.name,
      skinType: skinType || "normal",
      environment: environment || "none",
      datasetInfo: getDatasetMeta(),
      summary: buildSummary(results, skinType),
    });
  } catch (err) {
    console.error("Error in /api/compare:", err);
    res.status(500).json({ error: "Something went wrong comparing products." });
  }
});

function buildSummary(results, skinType) {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const diff = best.score - worst.score;

  if (diff < 5) return `All products score similarly for ${skinType || "your"} skin type — the difference is within the margin of confidence.`;
  return `${best.name} scores highest (${best.score}/100) for ${skinType || "your"} skin type. ${worst.name} has the most concerns (${worst.score}/100).`;
}

/**
 * GET /api/search-products?q=sunscreen&category=sunscreens
 * Searches Open Beauty Facts — the open-source alternative to Nykaa/Tira.
 * Open Beauty Facts: https://world.openbeautyfacts.org
 * - Free, no API key needed
 * - 2M+ beauty products from global brands including Indian market
 * - Updated daily by community
 * - CC0 data license (fully open)
 */
router.get("/search-products", async (req, res) => {
  try {
    const { q, category } = req.query;

    if (!q && !category) {
      return res.status(400).json({ error: "Provide a search query (q) or category." });
    }

    // Open Beauty Facts search API
    // Docs: https://wiki.openfoodfacts.org/API (same structure for beauty)
    const searchTerm = q || category || "";
    const url = new URL("https://world.openbeautyfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", searchTerm);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "12");
    url.searchParams.set("fields", "product_name,brands,ingredients_text,image_url,categories,countries_tags");

    let response;
    try {
      response = await fetch(url.toString(), {
        headers: { "User-Agent": "AmbrosiaApp/2.0 (open-source ingredient checker)" },
        signal: AbortSignal.timeout(8000),
      });
    } catch (fetchErr) {
      // If Open Beauty Facts is unreachable, return curated sample data
      // so the feature still works for demos
      return res.json({
        products: SAMPLE_PRODUCTS.filter(p =>
          !q || p.product_name.toLowerCase().includes(q.toLowerCase()) ||
          p.brands.toLowerCase().includes(q.toLowerCase())
        ).slice(0, 6),
        source: "sample-data",
        sourceNote: "Open Beauty Facts API is currently unreachable. Showing sample products for demo purposes.",
        count: 6,
      });
    }

    if (!response.ok) {
      throw new Error(`Open Beauty Facts returned ${response.status}`);
    }

    const data = await response.json();
    const products = (data.products || [])
      .filter(p => p.product_name && p.ingredients_text)
      .map(p => ({
        product_name: p.product_name,
        brands: p.brands || "",
        ingredients_text: p.ingredients_text,
        image_url: p.image_url || null,
        categories: p.categories || "",
        countries: p.countries_tags || [],
      }));

    res.json({
      products,
      source: "open-beauty-facts",
      sourceNote: "Data from Open Beauty Facts (openbeautyfacts.org) — free, open-source, updated daily.",
      count: data.count || products.length,
    });
  } catch (err) {
    console.error("Error in /api/search-products:", err);
    // Return sample data as fallback
    res.json({
      products: SAMPLE_PRODUCTS.slice(0, 6),
      source: "sample-data",
      sourceNote: "Open Beauty Facts API is currently unreachable. Showing sample products.",
      count: 6,
    });
  }
});

// Curated sample products for demo/fallback — real products with real ingredient lists
const SAMPLE_PRODUCTS = [
  {
    product_name: "Neutrogena Ultra Sheer SPF 50+ Sunscreen",
    brands: "Neutrogena",
    ingredients_text: "Aqua, Homosalate, Alcohol Denat., Octisalate, Octocrylene, Avobenzone, Glycerin, Silica, Dimethicone, Tocopheryl Acetate, Sodium Hyaluronate, Panthenol, Dimethiconol, Carbomer, Sodium Hydroxide, Phenoxyethanol, EDTA",
    categories: "Sunscreens",
  },
  {
    product_name: "Minimalist 10% Niacinamide Serum",
    brands: "Minimalist",
    ingredients_text: "Aqua, Niacinamide, Pentylene Glycol, Zinc PCA, Tamarindus Indica Seed Gum, Allantoin, Sodium PCA, Arginine, Aspartic Acid, Glycine, Alanine, Sodium Hyaluronate, Phenoxyethanol, Ethylhexylglycerin",
    categories: "Serums",
  },
  {
    product_name: "Lakme 9 to 5 Matte Foundation",
    brands: "Lakme",
    ingredients_text: "Aqua, Cyclopentasiloxane, Dimethicone, Titanium Dioxide, Isododecane, Trimethylsiloxysilicate, Disteardimonium Hectorite, Magnesium Sulfate, Phenoxyethanol, Parfum, Tocopheryl Acetate, Alcohol, Talc",
    categories: "Foundations",
  },
  {
    product_name: "Biotique Bio Morning Nector SPF 30",
    brands: "Biotique",
    ingredients_text: "Aqua, Oxybenzone, Octyl Methoxycinnamate, Butyl Methoxydibenzoylmethane, Glycerin, Cetearyl Alcohol, Stearic Acid, Triethanolamine, Sodium Benzoate, Potassium Sorbate, Parfum, Honey Extract, Wheat Germ Oil, Turmeric Extract",
    categories: "Sunscreens",
  },
  {
    product_name: "Sugar Cosmetics Matte Attack Lipstick",
    brands: "Sugar Cosmetics",
    ingredients_text: "Isododecane, Trimethylsiloxysilicate, Dimethicone, Cyclopentasiloxane, Beeswax, Carnauba Wax, Tocopheryl Acetate, Vitamin E, BHA, Mica, Titanium Dioxide, Iron Oxides, Parfum",
    categories: "Lipsticks",
  },
  {
    product_name: "Lotus Herbals WhiteGlow Day Cream SPF 25",
    brands: "Lotus Herbals",
    ingredients_text: "Aqua, Octyl Methoxycinnamate, Titanium Dioxide, Glycerin, Stearic Acid, Cetearyl Alcohol, Niacinamide, Kojic Acid, Mulberry Extract, DMDM Hydantoin, Methylparaben, Propylparaben, Parfum, Sodium Hydroxide",
    categories: "Day Creams",
  },
  {
    product_name: "Plum E-Luminence Simply Moisturising Day Cream",
    brands: "Plum",
    ingredients_text: "Aqua, Glycerin, Caprylic/Capric Triglyceride, Niacinamide, Sodium Hyaluronate, Tocopheryl Acetate, Panthenol, Allantoin, Cetearyl Alcohol, Dimethicone, Phenoxyethanol, Ethylhexylglycerin, Carbomer, Sodium Hydroxide",
    categories: "Day Creams",
  },
  {
    product_name: "Kay Beauty Lip Liner",
    brands: "Kay Beauty",
    ingredients_text: "Hydrogenated Vegetable Oil, Ozokerite, Polyethylene, Carnauba Wax, Synthetic Wax, Silica, Tocopheryl Acetate, Parfum, BHT, Titanium Dioxide, Iron Oxides, Ultramarines",
    categories: "Lip Products",
  },
];

export default router;
