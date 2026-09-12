import { useEffect, useState } from "react";
import { api } from "../lib/api";
import "./About.css";

export default function About() {
  // Issue 7 fix: fetch live stats instead of hardcoding numbers
  const [datasetInfo, setDatasetInfo] = useState(null);
  useEffect(() => {
    api.datasetInfo().then(setDatasetInfo).catch(() => {});
  }, []);

  const flags = datasetInfo ? datasetInfo.flaggedIngredientCount : "—";
  const rules = datasetInfo ? datasetInfo.interactionWarningCount : "—";
  const total = datasetInfo ? datasetInfo.totalIngredients.toLocaleString() : "—";
  const reviewed = datasetInfo ? datasetInfo.lastReviewed : "—";

  return (
    <div className="about-page">
      <div className="about-header">
        <h1>About Ambrosia</h1>
        <p className="about-lead">
          An honest, open-source skincare ingredient checker. Here's exactly how it works and what it doesn't do.
        </p>
      </div>

      <div className="about-body">
        <section>
          <h2>What the score means</h2>
          <p>
            A score of 0–100 reflects how many ingredients were flagged for concern, weighted by their
            severity and by your specific skin type and environment. The same product scores differently
            for acne-prone vs dry skin because the math genuinely changes — not just the copy around it.
          </p>
          <p>
            The <strong>confidence label</strong> (high / medium / low) is equally important. A score
            built from 60% recognized ingredients is less reliable than one from 95%. We always show both.
            When unrecognized ingredients exist, we now also offer <strong>AI-assisted analysis</strong>{" "}
            via Google Gemini — clearly labeled as supplementary context, not regulatory data.
          </p>
        </section>

        <section>
          <h2>What databases we use</h2>
          <p>
            Ingredient identity is checked against a processed version of the{" "}
            <a href="https://ec.europa.eu/growth/tools-databases/cosing/" target="_blank" rel="noreferrer">
              EU CosIng substance database
            </a>{" "}
            — currently <strong>{total} INCI entries</strong> with CAS/EINECS/PubChem IDs.
          </p>
          <p>
            Safety flags are a curated layer on top — <strong>{flags} flagged categories</strong> and{" "}
            <strong>{rules} interaction rules</strong>, last reviewed <strong>{reviewed}</strong>.
            These numbers are reported live from the actual data file, not hardcoded in this page.
          </p>
          <p>
            For ingredients not found in our database, we optionally call{" "}
            <strong>Google Gemini (free tier)</strong> to provide AI-assisted context. Gemini
            results are always clearly separated from regulatory database flags and carry their
            own confidence and disclaimer labels.
          </p>
        </section>

        <section>
          <h2>What we honestly can't do</h2>
          <ul>
            <li>We cover {flags} curated safety flags. An ingredient not in that list is "recognized but unscored" — not "safe."</li>
            <li>We don't handle concentration-dependent risk. Labels don't publish concentrations, so we can't either.</li>
            <li>No live Nykaa/Tira product catalog — public ingredient-level APIs aren't available from Indian retailers yet. On the roadmap.</li>
            <li>OCR can misread small or low-contrast label text. We always show the extracted text for review before scoring.</li>
            <li>Gemini AI analysis is best-effort supplementary context — not a regulatory determination.</li>
            <li>This is not medical advice. Consult a dermatologist for individual skin concerns.</li>
          </ul>
        </section>

        <section>
          <h2>Open source</h2>
          <p>
            Ambrosia is MIT-licensed. The safety data is a versioned JSON file with source citations.
            Anyone can submit corrections or additions via GitHub — the primary contribution path is
            adding entries to <code>safety_flags.json</code> with a cited regulatory or clinical source.
          </p>
          <p>
            <a href="https://github.com/SHIVANIMUKHERJEE06/ambrosia" target="_blank" rel="noreferrer">
              View on GitHub →
            </a>
            {" · "}
            <a href="https://github.com/SHIVANIMUKHERJEE06/ambrosia/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">
              Contributing guide →
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
