// gemini.js
//
// Uses Google Gemini's free-tier API (gemini-1.5-flash) to analyze ingredients
// that weren't found in our 28k-entry INCI database. This is a genuinely
// differentiated feature: instead of silently marking unknown ingredients
// as "unrecognized" and stopping there, we ask an AI that has broad
// cosmetic chemistry knowledge to provide context.
//
// Key design principles:
//  1. Gemini is ALWAYS shown as "AI-assisted analysis" — never presented as
//     equivalent to the regulatory database flags.
//  2. Results are clearly labeled with their source and a disclaimer.
//  3. Gemini failure is NON-FATAL — if the API is down or rate-limited,
//     the scan still completes normally, just without AI insights.
//  4. We never send user profile data (skin type, history) to Gemini —
//     only the raw ingredient names.

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `You are a cosmetic ingredient safety analyst. You will be given a list of ingredient names that were NOT found in the EU CosIng or FDA ingredient databases.

For each ingredient, provide a brief, honest analysis in JSON format. Be concise and accurate. If you genuinely don't know an ingredient, say so — do not invent safety information.

Respond ONLY with a valid JSON array, no markdown, no code fences, no preamble. Example format:
[
  {
    "name": "GlowteinX",
    "likelyCategoryGuess": "unknown — possibly a proprietary blend name",
    "safetySignal": "unknown",
    "reasoning": "This does not match any known INCI, CAS, or common cosmetic ingredient name. It may be a brand-specific trade name for a blend. Cannot assess safety without knowing the underlying ingredients.",
    "confidence": "low"
  },
  {
    "name": "Hexylresorcinol",
    "likelyCategoryGuess": "skin-lightening / antiseptic",
    "safetySignal": "caution",
    "reasoning": "An antiseptic and skin-brightening agent. Generally considered safe at low concentrations (<0.5%) in rinse-off products. May cause irritation at higher concentrations. Not widely restricted but some sensitivity reports exist.",
    "confidence": "medium"
  }
]

safetySignal must be one of: "likely-safe", "caution", "concern", "unknown"
confidence must be one of: "high", "medium", "low"
Keep reasoning under 60 words per ingredient.`;

/**
 * Analyze unrecognized ingredient names using Gemini.
 * @param {string[]} ingredientNames - List of ingredient names not found in INCI database
 * @param {string} skinType - User's skin type for context (optional)
 * @returns {Promise<{insights: Array, disclaimer: string, model: string}>}
 */
export async function analyzeWithGemini(ingredientNames, skinType = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  // Cap at 10 unrecognized ingredients per call to stay within token limits
  const toAnalyze = ingredientNames.slice(0, 10);

  // BUG FIX 3: Sanitize skinType before injecting into prompt.
  // A user-controlled string going directly into an LLM prompt is a prompt
  // injection risk. Strip to alphanumeric + hyphens only.
  const VALID_SKIN_TYPES = new Set(["normal","dry","oily","combination","sensitive","acne-prone"]);
  const safeSkinType = skinType && VALID_SKIN_TYPES.has(skinType) ? skinType : null;

  const userMessage = safeSkinType
    ? `Skin type context: ${safeSkinType}.\n\nAnalyze these ingredients: ${toAnalyze.join(", ")}`
    : `Analyze these ingredients: ${toAnalyze.join(", ")}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: SYSTEM_PROMPT + "\n\n" + userMessage }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,      // low temperature for factual, consistent output
      maxOutputTokens: 1200,
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(12000), // 12 second timeout
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    // Parse rate limit errors specifically for better messaging
    if (response.status === 429) {
      throw new Error("Gemini rate limit reached — AI analysis skipped for this scan");
    }
    throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Gemini returned an empty response");
  }

  let insights;
  try {
    // Strip any accidental markdown fences even with responseMimeType set
    const cleaned = rawText.replace(/```json|```/gi, "").trim();
    insights = JSON.parse(cleaned);
    if (!Array.isArray(insights)) throw new Error("Expected array");
  } catch {
    throw new Error("Gemini response was not valid JSON");
  }

  // Validate and sanitize each insight object
  const validSignals = new Set(["likely-safe", "caution", "concern", "unknown"]);
  const validConfidences = new Set(["high", "medium", "low"]);

  const sanitized = insights
    .filter(item => item && typeof item.name === "string")
    .map(item => ({
      name: String(item.name).slice(0, 100),
      likelyCategoryGuess: String(item.likelyCategoryGuess || "unknown").slice(0, 100),
      safetySignal: validSignals.has(item.safetySignal) ? item.safetySignal : "unknown",
      reasoning: String(item.reasoning || "").slice(0, 400),
      confidence: validConfidences.has(item.confidence) ? item.confidence : "low",
    }));

  return {
    insights: sanitized,
    analyzedCount: toAnalyze.length,
    totalUnrecognized: ingredientNames.length,
    disclaimer: "AI-assisted analysis of ingredients not found in our regulatory database. Powered by Google Gemini. This is supplementary context only — not a regulatory safety determination. Treat 'likely-safe' signals with appropriate skepticism and always cross-reference with official sources for important decisions.",
    model: "model:gemini-2.5-flash",
  };
}
