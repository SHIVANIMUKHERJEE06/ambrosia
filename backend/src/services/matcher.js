// matcher.js
// Core ingredient-matching engine.
//
// This directly fixes loophole #1 from the project critique:
// "INCI names have synonyms, alternate spellings... A judge who knows
//  skincare will paste 'Tocopheryl Acetate' and you'll show nothing,
//  while your database has 'tocopherol'."
//
// Strategy (in order, cheapest/most-precise first):
//   1. Exact normalized match against the 28k-entry INCI master list
//   2. Known synonym/alias match against the curated safety flags list
//   3. Fuzzy match (Levenshtein-based) against the master list, with a
//      confidence score — ONLY auto-accepted above a high threshold,
//      otherwise surfaced to the user as "possible match" rather than
//      silently treated as either a hit or a miss.
//   4. If nothing clears the threshold, the ingredient is returned as
//      UNRECOGNIZED — visibly, not silently. This is what fixes the
//      "unrecognized ingredients are invisible" problem in loophole #0.

/**
 * Common consumer-facing names mapped to their INCI equivalents.
 * The CosIng master list is INCI-only; everyday names like "Coconut Oil"
 * won't exact-match "Cocos Nucifera Oil" without this table. This is a
 * curated starter set, not exhaustive — expandable via the open-source
 * contribution path described in the README.
 */
export const COMMON_NAME_ALIASES = {
  "aqua": "water",
  "eau": "water",
  "parfum": "fragrance",
  "perfume": "fragrance",
  "coconut oil": "cocos nucifera oil",
  "shea butter": "butyrospermum parkii butter",
  "argan oil": "argania spinosa kernel oil",
  "jojoba oil": "simmondsia chinensis seed oil",
  "vitamin e": "tocopherol",
  "vitamin c": "ascorbic acid",
  "vitamin b3": "niacinamide",
  "vitamin b5": "panthenol",
  "tea tree oil": "melaleuca alternifolia leaf oil",
  "rosehip oil": "rosa canina fruit oil",
  "aloe vera": "aloe barbadensis leaf juice",
  "green tea extract": "camellia sinensis leaf extract",
  "centella asiatica": "centella asiatica extract",
  "olive oil": "olea europaea fruit oil",
  "sunflower oil": "helianthus annuus seed oil",
  "almond oil": "prunus amygdalus dulcis oil",
  "sweet almond oil": "prunus amygdalus dulcis oil",
  "grapeseed oil": "vitis vinifera seed oil",
  "rosemary extract": "rosmarinus officinalis leaf extract",
  "witch hazel": "hamamelis virginiana extract",
  "honey": "mel",
  "beeswax": "cera alba",
  "baking soda": "sodium bicarbonate",
  "salt": "sodium chloride",
  "epsom salt": "magnesium sulfate",
};

/**
 * Normalize an ingredient name for comparison:
 * lowercase, trim, collapse whitespace, strip trailing punctuation,
 * standardize common separators.
 */
export function normalize(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[®™]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/g, "")
    .trim();
}

/**
 * Levenshtein edit distance, iterative DP, O(n*m).
 * Fine for short ingredient strings; not used on the whole database per call,
 * only against a narrowed candidate set (see findFuzzyMatch).
 */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[n];
}

function similarityScore(a, b) {
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

export class IngredientMatcher {
  /**
   * @param {Array<{inci:string, cosingId:string|null, cas:string|null, ec:string|null, pubchemCid:string|null}>} masterList
   * @param {Object} safetyData - parsed safety_flags.json
   */
  constructor(masterList, safetyData) {
    this.masterList = masterList;
    this.safetyData = safetyData;

    // Build exact-match index: normalized INCI name -> master record
    this.exactIndex = new Map();
    for (const entry of masterList) {
      const key = normalize(entry.inci);
      if (!this.exactIndex.has(key)) {
        this.exactIndex.set(key, entry);
      }
    }

    // Build synonym index: normalized synonym/canonical name -> safety flag record
    this.synonymIndex = new Map();
    for (const flag of safetyData.flaggedIngredients) {
      const names = [flag.canonicalName, ...(flag.synonyms || [])];
      for (const n of names) {
        this.synonymIndex.set(normalize(n), flag);
      }
    }

    // Precompute a normalized-name array for fuzzy search bucketed by first letter,
    // so we don't do a full O(N) scan with full Levenshtein for every unmatched token.
    this.byFirstChar = new Map();
    for (const [key, entry] of this.exactIndex.entries()) {
      const c = key[0] || "?";
      if (!this.byFirstChar.has(c)) this.byFirstChar.set(c, []);
      this.byFirstChar.get(c).push({ key, entry });
    }
  }

  /** Look up a safety flag for a normalized name (checks synonym index). */
  getSafetyFlag(normalizedName) {
    return this.synonymIndex.get(normalizedName) || null;
  }

  getComedogenicScore(normalizedName) {
    const score = this.safetyData.comedogenicityScores[normalizedName];
    return typeof score === "number" ? score : null;
  }

  /**
   * Attempt a fuzzy match against the master INCI list.
   * Searches first-character bucket, and for short tokens also the
   * second-character bucket as a fallback — this catches OCR errors that
   * drop the first letter entirely (e.g. "lycerin" → "glycerin"), which
   * is a real failure mode when label text bleeds off the edge of a photo.
   * Returns { entry, score } or null if nothing clears the threshold.
   */
  findFuzzyMatch(normalizedName, threshold = 0.82) {
    // Build candidate set: first-char bucket + second-char fallback for short words
    const candidateSet = new Map();
    const addBucket = (char) => {
      for (const item of (this.byFirstChar.get(char) || [])) {
        if (!candidateSet.has(item.key)) candidateSet.set(item.key, item);
      }
    };
    addBucket(normalizedName[0]);
    // For tokens under 12 chars, also check second-char bucket (Issue 9 fix)
    if (normalizedName.length <= 12 && normalizedName[1]) {
      addBucket(normalizedName[1]);
    }

    let best = null;
    let bestScore = 0;
    for (const { key, entry } of candidateSet.values()) {
      if (Math.abs(key.length - normalizedName.length) > 6) continue;
      const score = similarityScore(normalizedName, key);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    if (best && bestScore >= threshold) {
      return { entry: best, score: bestScore };
    }
    return null;
  }

  /**
   * Resolve a single raw ingredient token (as parsed from a label) into a
   * structured result. This is the function that MUST be honest about
   * what it doesn't know — see critique loophole #0 / "silently invisible".
   *
   * Tries, in order: the literal token, then (if the token has the
   * "INCI Name (Common Name)" pattern) each side of the parentheses
   * separately. The first candidate that resolves wins; if none resolve,
   * we report the result for the original full token so the UI shows
   * exactly what was on the label.
   */
  resolveIngredient(rawName) {
    const candidates = IngredientMatcher.splitParentheticalCandidates(rawName);
    let best = null;
    for (const candidate of candidates) {
      const result = this._resolveSingleCandidate(candidate, rawName);
      if (result.recognized) {
        return result; // first resolved candidate wins
      }
      if (!best) best = result; // keep the first (literal) as fallback
    }
    return best;
  }

  _resolveSingleCandidate(rawName, originalRawName) {
    const normalized = normalize(rawName);
    if (!normalized) {
      return null;
    }

    let masterEntry = this.exactIndex.get(normalized) || null;
    let matchType = masterEntry ? "exact" : null;
    let matchConfidence = masterEntry ? 1.0 : null;

    // Check the common-name alias table (e.g. "coconut oil" -> "cocos nucifera oil")
    if (!masterEntry) {
      const aliasTarget = COMMON_NAME_ALIASES[normalized];
      if (aliasTarget) {
        const aliasEntry = this.exactIndex.get(normalize(aliasTarget));
        if (aliasEntry) {
          masterEntry = aliasEntry;
          matchType = "alias";
          matchConfidence = 1.0;
        }
      }
    }

    // Try fuzzy match against master list if still no hit
    if (!masterEntry) {
      const fuzzy = this.findFuzzyMatch(normalized);
      if (fuzzy) {
        masterEntry = fuzzy.entry;
        matchType = "fuzzy";
        matchConfidence = Math.round(fuzzy.score * 100) / 100;
      }
    }

    // Safety flag lookup checks the raw normalized input, the resolved
    // master entry's canonical name, AND the alias table, since safety
    // data is keyed by canonical/synonym names which may differ from the
    // literal label text.
    let safetyFlag =
      this.getSafetyFlag(normalized) ||
      (masterEntry ? this.getSafetyFlag(normalize(masterEntry.inci)) : null);

    const comedogenicScore =
      this.getComedogenicScore(normalized) ??
      (masterEntry ? this.getComedogenicScore(normalize(masterEntry.inci)) : null);

    return {
      rawInput: originalRawName,
      matchedOn: rawName !== originalRawName ? rawName : null,
      normalized,
      recognized: !!masterEntry,
      matchType, // "exact" | "alias" | "fuzzy" | null
      matchConfidence, // 1.0, 0.82-0.99, or null
      resolvedInci: masterEntry ? masterEntry.inci : null,
      cosingId: masterEntry ? masterEntry.cosingId : null,
      cas: masterEntry ? masterEntry.cas : null,
      ec: masterEntry ? masterEntry.ec : null,
      safetyFlag: safetyFlag
        ? {
            id: safetyFlag.id,
            canonicalName: safetyFlag.canonicalName,
            category: safetyFlag.category,
            severity: safetyFlag.severity,
            reason: safetyFlag.reason,
            regions: safetyFlag.regions,
          }
        : null,
      comedogenicScore: comedogenicScore ?? null,
    };
  }

  /**
   * Parse a raw ingredient-list string (as pasted by a user or returned by OCR)
   * into individual ingredient tokens. Handles common label punctuation,
   * including the common "INCI Name (Common Name)" pattern, e.g.
   * "Aqua (Water)" or "Parfum (Fragrance)" — both the INCI term and the
   * parenthetical common name are kept as lookup candidates for that token,
   * since labels are inconsistent about which one a database will recognize.
   */
  static parseIngredientListString(text) {
    if (!text) return [];
    // Remove a leading "Ingredients:" / "INCI:" label if present
    const cleaned = text.replace(/^\s*(ingredients|inci)\s*:?\s*/i, "");
    // Split on commas, but be careful of parenthetical sub-ingredients
    // e.g. "Aqua (Water), Glycerin, Parfum (Fragrance)" — split only on
    // top-level commas, not ones nested inside parentheses.
    const tokens = [];
    let depth = 0;
    let current = "";
    for (const ch of cleaned) {
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) {
        tokens.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    return tokens
      .map((t) => t.replace(/\.$/, "").trim())
      .filter((t) => t.length > 0);
  }

  /**
   * Given a raw token that may be "INCI Name (Common Name)", split it into
   * its candidate lookup strings: the full token, the part before the
   * parenthesis, and the part inside the parenthesis. resolveIngredient
   * tries these in order and keeps the first that resolves, so "Aqua (Water)"
   * matches on "Aqua" even though "Water" alone is the literal INCI entry.
   */
  static splitParentheticalCandidates(rawToken) {
    const match = rawToken.match(/^(.*?)\(([^)]+)\)\s*$/);
    if (!match) return [rawToken];
    const before = match[1].trim();
    const inside = match[2].trim();
    const candidates = [rawToken];
    if (before) candidates.push(before);
    if (inside) candidates.push(inside);
    return candidates;
  }

  /**
   * Resolve a full ingredient list (already parsed into an array of strings).
   * Returns per-ingredient results PLUS aggregate coverage stats, so the UI
   * can be honest about how much of the label it actually understood.
   */
  resolveIngredientList(ingredientNames) {
    const results = ingredientNames
      .map((name) => this.resolveIngredient(name))
      .filter(Boolean);

    const total = results.length;
    const recognized = results.filter((r) => r.recognized).length;
    const unrecognized = total - recognized;
    const flaggedCount = results.filter((r) => r.safetyFlag).length;

    return {
      ingredients: results,
      coverage: {
        total,
        recognized,
        unrecognized,
        recognizedPct: total > 0 ? Math.round((recognized / total) * 100) : 0,
      },
      flaggedCount,
    };
  }
}
