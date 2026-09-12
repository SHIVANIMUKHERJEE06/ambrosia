// dataLoader.js
// Loads the INCI master list and curated safety data once at server
// startup and exposes a singleton IngredientMatcher instance, so the
// 28,000+ entry dataset isn't re-parsed on every request.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { IngredientMatcher } from "../services/matcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

let matcherInstance = null;
let safetyDataInstance = null;
let masterListMeta = null;

export function loadMatcher() {
  if (matcherInstance) return matcherInstance;

  const masterPath = path.join(DATA_DIR, "inci_master.json");
  const safetyPath = path.join(DATA_DIR, "safety_flags.json");

  if (!fs.existsSync(masterPath)) {
    throw new Error(
      `Ingredient master list not found at ${masterPath}. Run the data setup step from the README before starting the server.`
    );
  }
  if (!fs.existsSync(safetyPath)) {
    throw new Error(`Safety flags file not found at ${safetyPath}.`);
  }

  const masterList = JSON.parse(fs.readFileSync(masterPath, "utf-8"));
  const safetyData = JSON.parse(fs.readFileSync(safetyPath, "utf-8"));

  matcherInstance = new IngredientMatcher(masterList, safetyData);
  safetyDataInstance = safetyData;
  masterListMeta = {
    totalIngredients: masterList.length,
    flaggedIngredientCount: safetyData.flaggedIngredients.length,
    interactionWarningCount: safetyData.interactionWarnings.length,
    lastReviewed: safetyData.meta.lastReviewed,
    sources: safetyData.meta.sources,
  };

  return matcherInstance;
}

export function getSafetyData() {
  if (!safetyDataInstance) loadMatcher();
  return safetyDataInstance;
}

export function getDatasetMeta() {
  if (!masterListMeta) loadMatcher();
  return masterListMeta;
}
