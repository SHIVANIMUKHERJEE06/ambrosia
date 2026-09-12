import { useState } from "react";
import { api } from "../lib/api";
import "./Interactions.css";

export default function Interactions() {
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleCheck(e) {
    e.preventDefault();
    if (!textA.trim() || !textB.trim()) {
      setError("Paste ingredient lists for both products.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.interactions(textA, textB);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="interactions-page">
      <div className="scan-header">
        <h1>Check for interactions</h1>
        <p className="scan-subtitle">
          Using two products in the same routine? We check for known interaction risks
          between them — like retinoid + acid over-exfoliation — that aren't obvious from either label alone.
        </p>
      </div>

      <form className="scan-form interactions-form" onSubmit={handleCheck}>
        <div className="interactions-grid">
          <div className="scan-form-row">
            <label htmlFor="textA">Product A ingredients</label>
            <textarea id="textA" rows={5} value={textA}
              onChange={e => setTextA(e.target.value)}
              placeholder="Aqua, Retinol, Glycerin, ..." />
          </div>
          <div className="scan-form-row">
            <label htmlFor="textB">Product B ingredients</label>
            <textarea id="textB" rows={5} value={textB}
              onChange={e => setTextB(e.target.value)}
              placeholder="Aqua, Glycolic Acid, Niacinamide, ..." />
          </div>
        </div>

        {error && <p className="scan-error">{error}</p>}
        <button type="submit" className="btn-primary scan-submit" disabled={loading}>
          {loading ? "Checking…" : "Check for interactions"}
        </button>
      </form>

      {result && (
        <div className="interactions-result">
          {/* Issue 6 fix: show coverage for both products */}
          <div className="coverage-row">
            <CoveragePill label="Product A" coverage={result.coverageA} />
            <CoveragePill label="Product B" coverage={result.coverageB} />
          </div>

          {result.warnings.length === 0 ? (
            <div className="no-warnings-card">
              <p>No known interaction warnings found between these two products.</p>
              <p className="no-warnings-caveat">
                This covers {result.coverageA?.recognized + result.coverageB?.recognized || "some"} verified
                ingredients across both products against 4 curated interaction rules (retinoid+acid,
                vitamin C+niacinamide, benzoyl peroxide+retinoid, stacked acids). Not a complete
                pharmacological database — when unsure, apply products at different times of day.
              </p>
            </div>
          ) : (
            <div className="warnings-list">
              {result.warnings.map(w => (
                <div key={w.id} className={`warning-card severity-${w.severity}`}>
                  <span className={`ingredient-badge badge-${w.severity}`}>{w.severity}</span>
                  <p>{w.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CoveragePill({ label, coverage }) {
  if (!coverage) return null;
  const pct = coverage.recognizedPct;
  const color = pct >= 90 ? "var(--color-sage)" : pct >= 70 ? "var(--color-honey)" : "var(--color-clay)";
  return (
    <div className="coverage-pill">
      <span className="coverage-label">{label}</span>
      <span className="coverage-stat" style={{ color }}>
        {coverage.recognized}/{coverage.total} ingredients verified ({pct}%)
      </span>
      {pct < 70 && (
        <span className="coverage-warn">Low coverage — interaction results may be incomplete</span>
      )}
    </div>
  );
}
