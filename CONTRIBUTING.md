# Contributing to Ambrosia

Thank you for helping make skincare safer! Ambrosia is open source and the most valuable contributions are **ingredient safety data additions** — because that's what makes the tool more accurate for everyone.

## Primary contribution path: adding safety flags

The curated safety database lives in `backend/src/data/safety_flags.json`.

### How to add or correct a flagged ingredient

1. Fork the repository and create a branch: `git checkout -b add-ingredient-xyz`
2. Open `backend/src/data/safety_flags.json`
3. Add your entry to the `flaggedIngredients` array, following this exact schema:

```json
{
  "id": "unique-slug-for-this-ingredient",
  "canonicalName": "INCI Name As It Appears On Labels",
  "synonyms": ["alternate name 1", "alternate name 2"],
  "category": "one-of-the-categories-below",
  "severity": "high | medium | low",
  "reason": "Clear explanation a non-expert can understand. Cite the source inline.",
  "regions": {
    "eu": "banned | restricted-concentration | allowed | labeling-required",
    "us_fda": "banned | restricted-otc | allowed | no-specific-restriction"
  }
}
```

**Valid categories:**
`formaldehyde-releaser`, `formaldehyde-releaser-or-source`, `preservative-allergen`,
`preservative-endocrine-concern`, `preservative-low-concern`, `irritant-surfactant`,
`irritant-drying`, `phototoxic`, `skin-lightening-restricted`, `carcinogen-restricted`,
`heavy-metal-banned`, `uv-filter-concern`, `antioxidant-concern`, `antimicrobial-restricted`,
`active-interaction-risk`, `particulate-contamination-history`, `undisclosed-mixture-allergen-risk`

4. **Mandatory: include the source** in the `reason` field or as a comment. Acceptable sources:
   - EU Cosmetics Regulation Annex II/III/V (link to EUR-Lex entry)
   - EU CosIng database entry URL
   - FDA prohibited/restricted ingredients list
   - Peer-reviewed clinical study (PubMed ID preferred)

5. Update the `meta.lastReviewed` date at the top of the JSON file.
6. Open a Pull Request. Title format: `[ingredient] Add/Update: [Canonical Name]`

### Adding common-name aliases

If a consumer-facing name (like "shea butter") doesn't match its INCI form ("butyrospermum parkii butter"), add it to `COMMON_NAME_ALIASES` in `backend/src/services/matcher.js`.

## Code contributions

- Backend is Node.js/Express ES modules — no build step, just run `npm run dev`
- Frontend is React + Vite — `npm run dev` in the `frontend/` folder
- Please don't add new npm dependencies without discussing in an issue first — keeping the dependency count low is a deliberate choice for a beginner-maintainable project

## Bug reports

Open an issue with:
1. The exact ingredient list you pasted (or describe the label)
2. What score/result you got
3. What you expected instead

## Questions?

Open a GitHub Discussion — not an Issue.
