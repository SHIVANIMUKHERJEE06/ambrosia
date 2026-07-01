# Ambrosia 🌿
**Open-source skincare ingredient checker with AI analysis and product comparison.**

> ⚠️ **Before presenting:** Replace `ShivaniM@06` everywhere with your actual GitHub username.

## Features
| Feature | Details |
|---|---|
| Ingredient scan | 28,354 real INCI entries from EU CosIng — not 20 hardcoded ones |
| Honest unknowns | Unrecognized ingredients penalise the score and get Gemini AI analysis |
| Personalized score | Math changes per skin type + environment — not just cosmetic copy |
| Product comparison | 2–3 products side by side with Open Beauty Facts search |
| Interaction checker | Catches risky pairs within a single product's formula too |
| Photo OCR | Google Cloud Vision reads ingredient text from label photos |
| History & profiles | Scan history and skin profiles persisted per user account |

## Quick start
```bash
git clone https://github.com/ShivaniM@06/ambrosia
cd ambrosia && npm run install:all
cp backend/.env.example backend/.env
# Set JWT_SECRET in backend/.env (see AMBROSIA_COMPLETE_GUIDE.docx)
npm run dev:backend   # Terminal 1 → http://localhost:4000
npm run dev:frontend  # Terminal 2 → http://localhost:5173
```

## Tech stack
- **Frontend**: React + Vite → Vercel (free)
- **Backend**: Node.js + Express + rate limiting → Render (free)
- **Database**: lowdb JSON file (zero native compilation)
- **Ingredients**: EU CosIng — 28k+ INCI entries (MIT license)
- **Product search**: Open Beauty Facts API (free, open-source, 2M+ products, daily updates)
- **AI analysis**: Google Gemini 1.5 Flash (free: 15 req/min)
- **OCR**: Google Cloud Vision (free: 1,000/month)

## Product database (replaces Nykaa/Tira)
Ambrosia uses **Open Beauty Facts** (`world.openbeautyfacts.org`) — a free, open-source database with 2M+ beauty products including Indian brands (Lakme, Biotique, Lotus, Sugar, Plum, Minimalist, etc.), updated daily by the community. No private API key required. Falls back to curated sample data when offline.

## Demo day checklist
- [ ] Replace `ShivaniM@06` in README, About.jsx, CONTRIBUTING.md
- [ ] Visit Render URL 2 min before presenting to wake it up (free tier spins down)
- [ ] Test with a real 30-ingredient label before presenting
- [ ] Bookmark `/api/health` to verify backend is alive

## Known limitations (state proactively)
- 23 curated safety flags (reported live, never hardcoded)
- No concentration-dependent risk (labels don't publish concentrations)
- Gemini AI = supplementary context, not regulatory data

## License
MIT — see LICENSE. Contributing: see CONTRIBUTING.md.
