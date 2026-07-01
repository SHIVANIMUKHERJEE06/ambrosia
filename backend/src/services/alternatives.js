// alternatives.js
//
// Fixes loophole #3 from the critique:
// "Hardcoded 'alternatives.' Every single product gets recommended the
//  same 4 items regardless of what was actually scanned. Scan a lipstick,
//  get a niacinamide serum recommendation. This isn't personalization,
//  it's a static placeholder."
//
// HONESTY NOTE: Ambrosia does not have a live product catalog connected
// (Nykaa/Tira don't expose a public ingredient-level API as of this
// writing — see README "Known Limitations"). So instead of inventing
// fake product names/brands (which would be a worse lie than the
// original hardcoded list), this engine generates INGREDIENT-LEVEL
// substitution guidance that is actually derived from what was flagged
// in THIS product. That's honest, useful, and grounded in real data,
// versus a static "here are 4 product names" placeholder.
//
// The README documents Open Beauty Facts barcode integration as the
// concrete next step to get to real product-level recommendations.

const SUBSTITUTION_GUIDANCE = {
  "formaldehyde-releaser": {
    lookFor: ["Phenoxyethanol", "Sodium Benzoate", "Potassium Sorbate", "Benzyl Alcohol"],
    why: "These are common preservatives that don't carry formaldehyde-release risk, and are widely used as direct substitutes in reformulated products.",
  },
  "formaldehyde-releaser-or-source": {
    lookFor: ["Phenoxyethanol", "Sodium Benzoate", "Potassium Sorbate"],
    why: "Non-formaldehyde-releasing preservative alternatives commonly used in reformulated 'clean' versions of similar products.",
  },
  "preservative-allergen": {
    lookFor: ["Phenoxyethanol", "Caprylyl Glycol", "Ethylhexylglycerin"],
    why: "Lower-allergen preservative systems frequently used as drop-in replacements for MIT/MI-based formulas.",
  },
  "preservative-endocrine-concern": {
    lookFor: ["Phenoxyethanol", "Sodium Benzoate", "Sorbic Acid"],
    why: "Preservatives without the endocrine-disruption concern data associated with long-chain parabens.",
  },
  "undisclosed-mixture-allergen-risk": {
    lookFor: ["Fragrance-Free", "Unscented", "products labeled with full essential-oil disclosure"],
    why: "Products explicitly labeled fragrance-free avoid the undisclosed-allergen-mixture risk entirely.",
  },
  "irritant-surfactant": {
    lookFor: ["Coco-Glucoside", "Decyl Glucoside", "Sodium Cocoyl Isethionate"],
    why: "Gentler sulfate-free surfactants that clean effectively with a lower irritation profile, especially for sensitive or compromised skin barriers.",
  },
  "irritant-drying": {
    lookFor: ["Glycerin-based or alcohol-free formulas"],
    why: "Avoiding high concentrations of denatured alcohol reduces barrier-drying effects, particularly relevant for dry or sensitive skin.",
  },
  "uv-filter-concern": {
    lookFor: ["Zinc Oxide", "Titanium Dioxide"],
    why: "Mineral UV filters with a well-established safety profile and no documented hormone-disruption signal, unlike some chemical filters.",
  },
  "antimicrobial-restricted": {
    lookFor: ["Products without added antibacterial agents"],
    why: "Daily cosmetic products generally don't need antimicrobial agents like Triclosan; plain formulations avoid the regulatory concern entirely.",
  },
  "particulate-contamination-history": {
    lookFor: ["Cornstarch-based or rice-powder-based formulas"],
    why: "Plant-starch-based powders avoid both the historical talc contamination concern and inhalation risk profile.",
  },
  "phototoxic": {
    lookFor: ["products without cold-pressed citrus peel oils, or used only in rinse-off formats"],
    why: "Steam-distilled citrus extracts (rather than cold-pressed) typically have the phototoxic furanocoumarins removed.",
  },
};

const COMEDOGENIC_SUBSTITUTION = {
  lookFor: ["Squalane", "Jojoba Oil (Simmondsia Chinensis Seed Oil)", "Niacinamide", "Hyaluronic Acid"],
  why: "Lower-comedogenicity hydrating/emollient ingredients that are less likely to contribute to clogged pores for acne-prone or oily skin.",
};

/**
 * Generate substitution guidance from the ACTUAL flagged ingredients and
 * comedogenic ingredients in a resolved ingredient list — never a static list.
 */
export function generateAlternativeGuidance(resolvedList, skinType) {
  const seenCategories = new Set();
  const suggestions = [];

  for (const ing of resolvedList.ingredients) {
    if (ing.safetyFlag && !seenCategories.has(ing.safetyFlag.category)) {
      seenCategories.add(ing.safetyFlag.category);
      const guidance = SUBSTITUTION_GUIDANCE[ing.safetyFlag.category];
      if (guidance) {
        suggestions.push({
          triggeredBy: ing.resolvedInci || ing.rawInput,
          flagSeverity: ing.safetyFlag.severity,
          lookFor: guidance.lookFor,
          why: guidance.why,
        });
      }
    }
  }

  const hasHighComedogenic = resolvedList.ingredients.some(
    (i) => i.comedogenicScore !== null && i.comedogenicScore >= 4
  );
  if (
    hasHighComedogenic &&
    (skinType === "acne-prone" || skinType === "oily" || !skinType)
  ) {
    suggestions.push({
      triggeredBy: "high comedogenicity ingredients in this product",
      flagSeverity: "medium",
      lookFor: COMEDOGENIC_SUBSTITUTION.lookFor,
      why: COMEDOGENIC_SUBSTITUTION.why,
    });
  }

  return {
    suggestions,
    honestyNote:
      suggestions.length === 0
        ? "No specific ingredient concerns were flagged in this product for substitution guidance."
        : "These are ingredient-level substitution categories based on what was actually flagged in this product, not a fixed list of products. Ambrosia does not currently have a live product catalog to recommend specific branded alternatives — see the project README for the roadmap on this.",
  };
}
