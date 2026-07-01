// scoring.js — fixed: Issue 1 (proportional deductions), Issue 3 (self-interaction warnings)

const SEVERITY_PENALTY = { high: 14, medium: 8, low: 3 };
const MAX_FLAG_PENALTY = 65;
const UNRECOGNIZED_PENALTY_PER_PERCENT = 0.2;
const UNRECOGNIZED_PENALTY_CAP = 20;
const COMEDOGENIC_BASE_PENALTY = { 0: 0, 1: 0, 2: 2, 3: 4, 4: 7, 5: 10 };
const MAX_COMEDOGENIC_PENALTY = 20;

const SKIN_TYPE_WEIGHTS = {
  "acne-prone":  { comedogenicMultiplier: 1.8, irritantMultiplier: 1.1, fragranceMultiplier: 1.0 },
  "sensitive":   { comedogenicMultiplier: 1.0, irritantMultiplier: 1.8, fragranceMultiplier: 1.6 },
  "dry":         { comedogenicMultiplier: 0.6, irritantMultiplier: 1.3, fragranceMultiplier: 1.0 },
  "oily":        { comedogenicMultiplier: 1.5, irritantMultiplier: 0.9, fragranceMultiplier: 1.0 },
  "combination": { comedogenicMultiplier: 1.2, irritantMultiplier: 1.1, fragranceMultiplier: 1.0 },
  "normal":      { comedogenicMultiplier: 1.0, irritantMultiplier: 1.0, fragranceMultiplier: 1.0 },
};

const IRRITANT_CATEGORIES = new Set([
  "irritant-surfactant","irritant-drying","preservative-allergen",
  "formaldehyde-releaser","formaldehyde-releaser-or-source",
]);
const FRAGRANCE_CATEGORIES = new Set(["undisclosed-mixture-allergen-risk","phototoxic"]);

const ENVIRONMENT_ADJUSTMENTS = {
  "high-humidity":  { comedogenicMultiplier: 1.15 },
  "dry-arid":       { irritantMultiplier: 1.15 },
  "high-uv":        { phototoxicMultiplier: 1.4 },
  "pollution-heavy":{ irritantMultiplier: 1.1 },
  "none": {},
};

export function scoreProduct(resolvedList, profile = {}, interactionWarnings = []) {
  const skinType = profile.skinType || "normal";
  const environment = profile.environment || "none";
  const weights = SKIN_TYPE_WEIGHTS[skinType] || SKIN_TYPE_WEIGHTS.normal;
  const envAdj = ENVIRONMENT_ADJUSTMENTS[environment] || {};

  let score = 100;
  const rawDeductions = []; // collect before capping
  let totalFlagPenalty = 0;
  let totalComedoPenalty = 0;

  // 1. Flagged safety ingredients
  for (const ing of resolvedList.ingredients) {
    if (!ing.safetyFlag) continue;
    const base = SEVERITY_PENALTY[ing.safetyFlag.severity] || 3;
    let multiplier = 1.0;
    if (IRRITANT_CATEGORIES.has(ing.safetyFlag.category)) {
      multiplier *= weights.irritantMultiplier;
      if (envAdj.irritantMultiplier) multiplier *= envAdj.irritantMultiplier;
    }
    if (FRAGRANCE_CATEGORIES.has(ing.safetyFlag.category)) {
      multiplier *= weights.fragranceMultiplier;
      if (envAdj.phototoxicMultiplier && ing.safetyFlag.category === "phototoxic") {
        multiplier *= envAdj.phototoxicMultiplier;
      }
    }
    const penalty = Math.round(base * multiplier * 10) / 10;
    totalFlagPenalty += penalty;
    rawDeductions.push({
      ingredient: ing.resolvedInci || ing.rawInput,
      reason: ing.safetyFlag.reason,
      severity: ing.safetyFlag.severity,
      rawPenalty: penalty,
      personalizedNote: multiplier > 1.05
        ? `Weighted higher for your ${skinType} skin type${envAdj.irritantMultiplier || envAdj.phototoxicMultiplier ? " and environment" : ""}.`
        : null,
    });
  }

  // Apply flag penalty with cap
  const appliedFlagPenalty = Math.min(totalFlagPenalty, MAX_FLAG_PENALTY);
  score -= appliedFlagPenalty;

  // Issue 1 FIX: proportionally rescale displayed deductions so they sum to
  // exactly what was applied, not the uncapped raw total.
  // This means the judge can add up the numbers on screen and get the right answer.
  const flagScale = totalFlagPenalty > 0 ? appliedFlagPenalty / totalFlagPenalty : 1;
  const deductions = rawDeductions.map(d => ({
    ...d,
    pointsDeducted: Math.round(d.rawPenalty * flagScale * 10) / 10,
    rawPenalty: undefined, // don't expose internal field
  }));

  // 2. Comedogenic ingredients
  for (const ing of resolvedList.ingredients) {
    if (ing.comedogenicScore === null || ing.comedogenicScore === undefined) continue;
    const base = COMEDOGENIC_BASE_PENALTY[ing.comedogenicScore] || 0;
    if (base === 0) continue;
    let multiplier = weights.comedogenicMultiplier;
    if (envAdj.comedogenicMultiplier) multiplier *= envAdj.comedogenicMultiplier;
    const penalty = Math.round(base * multiplier * 10) / 10;
    totalComedoPenalty += penalty;
    deductions.push({
      ingredient: ing.resolvedInci || ing.rawInput,
      reason: `Comedogenicity rating ${ing.comedogenicScore}/5 — may contribute to clogged pores.`,
      severity: ing.comedogenicScore >= 4 ? "medium" : "low",
      pointsDeducted: penalty,
      personalizedNote: (skinType === "acne-prone" || skinType === "oily")
        ? `Weighted higher for ${skinType} skin.` : null,
    });
  }
  score -= Math.min(totalComedoPenalty, MAX_COMEDOGENIC_PENALTY);

  // 3. Unrecognized coverage gap
  const unrecognizedPct = 100 - resolvedList.coverage.recognizedPct;
  if (unrecognizedPct > 0) {
    const gapPenalty = Math.min(unrecognizedPct * UNRECOGNIZED_PENALTY_PER_PERCENT, UNRECOGNIZED_PENALTY_CAP);
    score -= gapPenalty;
    deductions.push({
      ingredient: null,
      reason: `${resolvedList.coverage.unrecognized} of ${resolvedList.coverage.total} ingredients could not be matched and were NOT assumed safe.`,
      severity: unrecognizedPct > 30 ? "high" : unrecognizedPct > 10 ? "medium" : "low",
      pointsDeducted: Math.round(gapPenalty * 10) / 10,
      personalizedNote: null,
      isCoverageGap: true,
    });
  }

  // 4. Issue 3 FIX: self-interaction check — catches risky pairs WITHIN a single product
  // (e.g. retinol + glycolic acid in the same formula, which the two-product checker
  //  would miss entirely if the user only scans one product)
  const selfInteractions = interactionWarnings.length > 0
    ? checkInteractions(resolvedList, resolvedList, interactionWarnings)
    : [];

  for (const warn of selfInteractions) {
    const penalty = warn.severity === "medium" ? 6 : warn.severity === "high" ? 10 : 2;
    score -= penalty;
    deductions.push({
      ingredient: null,
      reason: warn.message,
      severity: warn.severity,
      pointsDeducted: penalty,
      personalizedNote: "This interaction risk exists within this single product's own formula.",
      isInteractionWarning: true,
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let confidence;
  if (resolvedList.coverage.recognizedPct >= 90) confidence = "high";
  else if (resolvedList.coverage.recognizedPct >= 70) confidence = "medium";
  else confidence = "low";

  return {
    score,
    confidence,
    coverage: resolvedList.coverage,
    skinType,
    environment,
    selfInteractionWarnings: selfInteractions,
    deductions: deductions.sort((a, b) => b.pointsDeducted - a.pointsDeducted),
    verdict: getVerdictLabel(score, confidence),
    // Transparency note: shown to user when cap was hit
    capApplied: totalFlagPenalty > MAX_FLAG_PENALTY
      ? `Multiple high-severity ingredients were found. The score penalty was capped at ${MAX_FLAG_PENALTY} points from safety flags (uncapped total would have been ${Math.round(totalFlagPenalty)} pts). Displayed deduction values have been scaled proportionally.`
      : null,
  };
}

function getVerdictLabel(score, confidence) {
  if (confidence === "low") return "Limited data — review manually";
  if (score >= 80) return "Looks good for your profile";
  if (score >= 60) return "Some concerns — review flagged ingredients";
  if (score >= 40) return "Several concerns — proceed with caution";
  return "Significant concerns flagged";
}

export function checkInteractions(resolvedListA, resolvedListB, interactionWarnings) {
  const namesA = new Set(
    resolvedListA.ingredients
      .filter(i => i.recognized)
      .flatMap(i => [
        (i.resolvedInci || "").toLowerCase(),
        (i.rawInput || "").toLowerCase(),
      ])
  );
  const namesB = new Set(
    resolvedListB.ingredients
      .filter(i => i.recognized)
      .flatMap(i => [
        (i.resolvedInci || "").toLowerCase(),
        (i.rawInput || "").toLowerCase(),
      ])
  );

  const warnings = [];
  const seen = new Set();
  for (const rule of interactionWarnings) {
    const triggers = rule.triggerIngredients.map(s => s.toLowerCase());
    const counterparts = rule.counterpartIngredients.map(s => s.toLowerCase());
    const aHasTrigger = triggers.some(t => namesA.has(t));
    const bHasCounterpart = counterparts.some(c => namesB.has(c));
    const aHasCounterpart = counterparts.some(c => namesA.has(c));
    const bHasTrigger = triggers.some(t => namesB.has(t));
    if (((aHasTrigger && bHasCounterpart) || (bHasTrigger && aHasCounterpart)) && !seen.has(rule.id)) {
      seen.add(rule.id);
      warnings.push({ id: rule.id, severity: rule.severity, message: rule.message });
    }
  }
  return warnings;
}
