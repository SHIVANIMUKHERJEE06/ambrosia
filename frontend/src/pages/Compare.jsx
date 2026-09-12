import { useState } from "react";
import { api } from "../lib/api";
import "./Compare.css";

const PRODUCT_CATEGORIES = [
  { value: "sunscreens", label: "☀️ Sunscreens" },
  { value: "serums", label: "💧 Serums" },
  { value: "moisturiser", label: "🌿 Moisturisers / Day Creams" },
  { value: "foundations", label: "💄 Foundations" },
  { value: "lipstick", label: "💋 Lipsticks" },
  { value: "cleanser", label: "🫧 Cleansers" },
];
const SKIN_TYPES = [
  { value: "normal", label: "Normal" }, { value: "dry", label: "Dry" },
  { value: "oily", label: "Oily" }, { value: "combination", label: "Combination" },
  { value: "sensitive", label: "Sensitive" }, { value: "acne-prone", label: "Acne-prone" },
];
const EMPTY_PRODUCT = { name: "", ingredientText: "" };

export default function Compare() {
  const [products, setProducts] = useState([{ ...EMPTY_PRODUCT }, { ...EMPTY_PRODUCT }]);
  const [skinType, setSkinType] = useState("normal");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState(null);

  function addProduct() { if (products.length < 3) setProducts(p => [...p, { ...EMPTY_PRODUCT }]); }
  function removeProduct(i) { if (products.length > 2) setProducts(p => p.filter((_, idx) => idx !== i)); }
  function updateProduct(i, field, val) {
    setProducts(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  // BUG FIX 1: Use api wrapper (with VITE_API_BASE_URL prefix + auth token) instead of raw fetch
  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim() && !searchCategory) return;
    setSearching(true);
    setSearchResults(null);
    setSearchError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (searchCategory) params.set("category", searchCategory);
      // Use api wrapper so VITE_API_BASE_URL is applied in production
      const data = await api.getJSON(`/search-products?${params}`);
      setSearchResults(data);
    } catch (err) {
      setSearchError(err.message || "Search failed. Showing sample products instead.");
      // Fallback: trigger with empty query to get sample data
      try {
        const fallback = await api.getJSON("/search-products?q=sunscreen");
        setSearchResults({ ...fallback, sourceNote: "Search unavailable — showing sample products." });
      } catch { /* silent */ }
    } finally {
      setSearching(false);
    }
  }

  // BUG FIX 1 (continued): Compare also uses api wrapper
  async function handleCompare(e) {
    e.preventDefault();
    const filled = products.filter(p => p.ingredientText.trim());
    if (filled.length < 2) {
      setError("Fill in ingredient lists for at least 2 products.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.compareProducts(
        filled.map(p => ({ name: p.name.trim().slice(0, 200), ingredientText: p.ingredientText })),
        skinType
      );
      setResult(data);
    } catch (err) {
      setError(err.message || "Comparison failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function useSearchResult(product, slotIndex) {
    updateProduct(slotIndex, "name", product.product_name);
    updateProduct(slotIndex, "ingredientText", product.ingredients_text);
    setSearchResults(null);
    setSearchQuery("");
  }

  return (
    <div className="compare-page">
      <div className="compare-header">
        <h1>Compare products</h1>
        <p className="compare-subtitle">
          Side-by-side safety comparison for 2–3 products. Find which sunscreen, serum or
          foundation is actually better for your skin type.
        </p>
      </div>

      {/* Open Beauty Facts search */}
      <div className="obf-search-box">
        <div className="obf-header">
          <h2>Find products to compare</h2>
          <span className="obf-badge">Open Beauty Facts</span>
        </div>
        <p className="obf-desc">
          Search 2M+ real products including Indian brands — from Open Beauty Facts
          (openbeautyfacts.org), the free open-source beauty database updated daily.
        </p>
        <form className="obf-form" onSubmit={handleSearch}>
          <input type="text" className="obf-input"
            placeholder='e.g. "Neutrogena sunscreen" or "Minimalist serum"'
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <select className="obf-select" value={searchCategory}
            onChange={e => setSearchCategory(e.target.value)}>
            <option value="">All categories</option>
            {PRODUCT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button type="submit" className="obf-search-btn" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        {searchError && <p className="obf-search-error">{searchError}</p>}

        {searchResults && (
          <div className="obf-results">
            {searchResults.sourceNote && (
              <p className="obf-source-note">{searchResults.sourceNote}</p>
            )}
            {!searchResults.products?.length && (
              <p className="obf-empty">No products found. Try a different search term.</p>
            )}
            <div className="obf-product-grid">
              {searchResults.products?.map((product, i) => (
                <div key={i} className="obf-product-card">
                  <div className="obf-product-info">
                    <span className="obf-product-name">{product.product_name}</span>
                    {product.brands && <span className="obf-brand">{product.brands}</span>}
                  </div>
                  <div className="obf-slot-buttons">
                    {products.map((_, slotIdx) => (
                      <button key={slotIdx} className="obf-use-btn"
                        onClick={() => useSearchResult(product, slotIdx)}>
                        Use as {slotIdx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comparison form */}
      <form className="compare-form" onSubmit={handleCompare}>
        <div className="compare-skin-row">
          <label>Skin type for comparison:</label>
          <div className="skin-pills">
            {SKIN_TYPES.map(s => (
              <label key={s.value} className={`skin-pill ${skinType === s.value ? "selected" : ""}`}>
                <input type="radio" name="skinType" value={s.value}
                  checked={skinType === s.value} onChange={() => setSkinType(s.value)} />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        <div className="compare-slots">
          {products.map((product, i) => (
            <div key={i} className="compare-slot">
              <div className="compare-slot-header">
                <span className="compare-slot-label">Product {i + 1}</span>
                {products.length > 2 && (
                  <button type="button" className="compare-remove-btn"
                    onClick={() => removeProduct(i)}>✕ Remove</button>
                )}
              </div>
              <input type="text" className="compare-name-input"
                placeholder="Product name (optional)" maxLength={200}
                value={product.name} onChange={e => updateProduct(i, "name", e.target.value)} />
              <textarea className="compare-ingredients-input" rows={5}
                placeholder="Paste ingredient list here…"
                value={product.ingredientText}
                onChange={e => updateProduct(i, "ingredientText", e.target.value)} />
              {product.ingredientText && (
                <p className="compare-char-count">{product.ingredientText.length} / 8000 chars</p>
              )}
            </div>
          ))}
        </div>

        {products.length < 3 && (
          <button type="button" className="compare-add-btn" onClick={addProduct}>
            + Add a third product
          </button>
        )}

        {error && <p className="scan-error">{error}</p>}

        <button type="submit" className="btn-primary compare-submit" disabled={loading}>
          {loading ? "Comparing…" : `Compare ${products.filter(p => p.ingredientText.trim()).length} products`}
        </button>
      </form>

      {result && <CompareResult result={result} />}
    </div>
  );
}

function scoreColor(score) {
  if (score >= 80) return "var(--color-sage)";
  if (score >= 60) return "var(--color-honey)";
  return "var(--color-clay)";
}
function scoreLabel(score) {
  if (score >= 80) return "Good";
  if (score >= 60) return "Caution";
  return "Concerns";
}

function CompareResult({ result }) {
  const { results, winner, summary, skinType, datasetInfo } = result;
  return (
    <div className="compare-result">
      <div className="compare-result-header">
        <h2>Comparison results</h2>
        <p className="compare-summary">{summary}</p>
        <p className="compare-skin-note">Scored for <strong>{skinType}</strong> skin type</p>
      </div>

      <div className="compare-score-row">
        {results.map((product, i) => {
          const isWinner = product.name === winner;
          return (
            <div key={i} className={`compare-score-card ${isWinner ? "winner" : ""}`}>
              {isWinner && <div className="winner-badge">Best pick</div>}
              <div className="compare-product-name">{product.name || `Product ${i + 1}`}</div>
              <div className="compare-score-ring">
                <svg viewBox="0 0 100 100" width="100" height="100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-line)" strokeWidth="7"/>
                  <circle cx="50" cy="50" r="42" fill="none"
                    stroke={scoreColor(product.score)} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - product.score / 100)}
                    transform="rotate(-90 50 50)"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                  <text x="50" y="45" textAnchor="middle"
                    style={{ fontFamily:"Fraunces,serif", fontSize:"24px", fontWeight:"700", fill:"var(--color-forest-dark)" }}>
                    {product.score}
                  </text>
                  <text x="50" y="59" textAnchor="middle"
                    style={{ fontFamily:"Karla,sans-serif", fontSize:"10px", fill:"var(--color-text-muted)" }}>
                    /100
                  </text>
                </svg>
              </div>
              <div className={`compare-verdict-badge verdict-${product.score >= 80 ? "good" : product.score >= 60 ? "caution" : "concern"}`}>
                {scoreLabel(product.score)}
              </div>
              <p className="compare-verdict-text">{product.verdict}</p>
              <div className="compare-coverage">
                {product.coverage.recognized}/{product.coverage.total} verified ({product.coverage.recognizedPct}%)
              </div>
            </div>
          );
        })}
      </div>

      <div className="compare-concerns-section">
        <h3>Top concerns by product</h3>
        <div className="compare-concerns-row">
          {results.map((product, i) => (
            <div key={i} className="compare-concerns-col">
              <h4>{product.name || `Product ${i + 1}`}</h4>
              {product.selfInteractionWarnings?.length > 0 && (
                <div className="compare-self-interaction">⚠️ In-formula interaction detected</div>
              )}
              {product.topConcerns.length === 0
                ? <p className="compare-no-concerns">No flagged ingredients detected</p>
                : <ul className="compare-concerns-list">
                    {product.topConcerns.map((c, j) => (
                      <li key={j} className={`compare-concern-item severity-${c.severity}`}>
                        <span className={`concern-dot dot-${c.severity}`} />
                        <span className="concern-name">{c.name}</span>
                        <span className={`concern-sev-badge badge-${c.severity}`}>{c.severity}</span>
                      </li>
                    ))}
                  </ul>
              }
              {product.highlights.length > 0 && (
                <div className="compare-highlights">
                  {product.highlights.map((h, j) => <p key={j} className="compare-highlight-item">✓ {h}</p>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="compare-stats-table">
        <h3>Quick stats</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              {results.map((p, i) => <th key={i}>{p.name || `Product ${i + 1}`}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              ["Safety score", p => <span style={{ color: scoreColor(p.score), fontWeight:"700" }}>{p.score}/100</span>],
              ["Flagged ingredients", p => <span style={{ color: p.totalFlagged > 2 ? "var(--color-clay)" : "inherit" }}>{p.totalFlagged}</span>],
              ["Coverage", p => `${p.coverage.recognizedPct}%`],
              ["Total ingredients", p => p.totalIngredients],
              ["Confidence", p => p.confidence],
              ["In-formula interactions", p => p.selfInteractionWarnings?.length > 0 ? "⚠️ Yes" : "✓ None"],
            ].map(([label, render], ri) => (
              <tr key={ri}>
                <td>{label}</td>
                {results.map((p, i) => <td key={i}>{render(p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="dataset-footer">
        Checked against {datasetInfo.totalIngredients.toLocaleString()} ingredient entries ·
        last reviewed {datasetInfo.lastReviewed} · Not medical advice.
        Product data: Open Beauty Facts (openbeautyfacts.org) — free, open-source.
      </p>
    </div>
  );
}
