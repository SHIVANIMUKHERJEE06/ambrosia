import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth.jsx";
import ScoreStamp from "../components/ScoreStamp.jsx";
import IngredientList from "../components/IngredientList.jsx";
import "./Scan.css";

const SKIN_TYPES = [
  { value: "normal", label: "Normal" },
  { value: "dry", label: "Dry" },
  { value: "oily", label: "Oily" },
  { value: "combination", label: "Combination" },
  { value: "sensitive", label: "Sensitive" },
  { value: "acne-prone", label: "Acne-prone" },
];
const ENVIRONMENTS = [
  { value: "none", label: "No specific factor" },
  { value: "high-humidity", label: "High humidity" },
  { value: "dry-arid", label: "Dry / arid climate" },
  { value: "high-uv", label: "High UV exposure" },
  { value: "pollution-heavy", label: "Heavy pollution / urban" },
];

export default function Scan() {
  const { loggedIn, profile, saveProfile } = useAuth();
  const [productName, setProductName] = useState("");
  const [ingredientText, setIngredientText] = useState("");
  const [skinType, setSkinType] = useState("normal");
  const [environment, setEnvironment] = useState("none");
  const [userChangedSettings, setUserChangedSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ocrNote, setOcrNote] = useState(null);
  const [result, setResult] = useState(null);
  const [saveToHistory, setSaveToHistory] = useState(false);
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);
  const fileInputRef = useRef(null);

  // Issue 5 fix: pre-populate from profile when it loads asynchronously,
  // but only if the user hasn't manually changed the dropdowns themselves.
  useEffect(() => {
    if (profile && !userChangedSettings) {
      if (profile.skinType) setSkinType(profile.skinType);
      if (profile.environment) setEnvironment(profile.environment);
    }
  }, [profile, userChangedSettings]);

  useEffect(() => {
    setSaveToHistory(loggedIn);
  }, [loggedIn]);

  function handleSkinTypeChange(val) {
    setSkinType(val);
    setUserChangedSettings(true);
  }
  function handleEnvironmentChange(val) {
    setEnvironment(val);
    setUserChangedSettings(true);
  }

  async function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setOcrLoading(true);
    setOcrNote(null);
    try {
      const data = await api.ocr(file);
      setIngredientText(data.cleanedGuess);
      setOcrNote(data.note);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcrLoading(false);
      e.target.value = "";
    }
  }

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!ingredientText.trim()) {
      setError("Paste an ingredient list, or upload a photo of one, before analyzing.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setProfileSavedNotice(false);
    try {
      const data = await api.analyze({
        ingredientText,
        productName: productName || undefined,
        skinType,
        environment,
        save: loggedIn && saveToHistory,
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Issue 8 fix: explicit "save to profile" button instead of silent auto-save
  async function handleSaveProfile() {
    try {
      await saveProfile({ skinType, environment, concerns: profile?.concerns || [] });
      setProfileSavedNotice(true);
      setTimeout(() => setProfileSavedNotice(false), 3000);
    } catch (err) {
      setError("Could not save profile: " + err.message);
    }
  }

  const profileDiffers = loggedIn && profile &&
    (skinType !== profile.skinType || environment !== profile.environment);

  return (
    <div className="scan-page">
      <div className="scan-header">
        <h1>Scan a product</h1>
        <p className="scan-subtitle">
          Paste the ingredient list from a label, or upload a photo and we'll read it for you.
        </p>
      </div>

      <form className="scan-form" onSubmit={handleAnalyze}>
        <div className="scan-form-row">
          <label htmlFor="productName">Product name <span className="optional-tag">optional</span></label>
          <input
            id="productName" type="text" value={productName}
            onChange={e => setProductName(e.target.value)}
            placeholder="e.g. Daily Hydrating Moisturizer"
            maxLength={200}
          />
        </div>

        <div className="scan-form-row">
          <div className="scan-textarea-header">
            <label htmlFor="ingredientText">Ingredient list</label>
            <button type="button" className="btn-photo"
              onClick={() => fileInputRef.current?.click()} disabled={ocrLoading}>
              {ocrLoading ? "Reading photo…" : "📷 Upload a photo instead"}
            </button>
            <input ref={fileInputRef} type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handlePhotoSelected} style={{ display: "none" }} />
          </div>
          <textarea id="ingredientText" rows={6} value={ingredientText}
            onChange={e => setIngredientText(e.target.value)}
            placeholder="Aqua, Glycerin, Niacinamide, Tocopheryl Acetate, Parfum, ..."
          />
          {ocrNote && <p className="ocr-note">{ocrNote}</p>}
        </div>

        <div className="scan-form-grid">
          <div className="scan-form-row">
            <label htmlFor="skinType">Your skin type</label>
            <select id="skinType" value={skinType}
              onChange={e => handleSkinTypeChange(e.target.value)}>
              {SKIN_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="scan-form-row">
            <label htmlFor="environment">Your environment</label>
            <select id="environment" value={environment}
              onChange={e => handleEnvironmentChange(e.target.value)}>
              {ENVIRONMENTS.map(env => <option key={env.value} value={env.value}>{env.label}</option>)}
            </select>
          </div>
        </div>

        {/* Issue 8 fix: explicit save-to-profile instead of silent auto-save */}
        {profileDiffers && (
          <div className="profile-sync-row">
            <span className="profile-sync-notice">
              These settings differ from your saved profile.
            </span>
            <button type="button" className="btn-sync-profile" onClick={handleSaveProfile}>
              Update profile to match
            </button>
          </div>
        )}
        {profileSavedNotice && (
          <p className="profile-saved-toast">✓ Profile updated to {skinType}</p>
        )}

        {loggedIn && (
          <label className="scan-save-toggle">
            <input type="checkbox" checked={saveToHistory}
              onChange={e => setSaveToHistory(e.target.checked)} />
            Save this scan to my history
          </label>
        )}

        {error && <p className="scan-error">{error}</p>}

        <button type="submit" className="btn-primary scan-submit" disabled={loading}>
          {loading ? "Analyzing…" : "Analyze ingredients"}
        </button>
      </form>

      {result && <ScanResult result={result} />}
    </div>
  );
}

function ScanResult({ result }) {
  const { score, coverage, ingredients, alternativeGuidance, geminiInsights, datasetInfo } = result;

  return (
    <div className="scan-result">
      <ScoreStamp scoreResult={score} coverage={coverage} />

      {/* Show self-interaction warnings prominently if detected */}
      {score.selfInteractionWarnings?.length > 0 && (
        <div className="self-interaction-banner">
          <h3>⚠️ Ingredient interaction detected within this product</h3>
          {score.selfInteractionWarnings.map((w, i) => (
            <div key={i} className={`warning-card severity-${w.severity}`}>
              <span className={`ingredient-badge badge-${w.severity}`}>{w.severity}</span>
              <p>{w.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Show cap notice if it was applied */}
      {score.capApplied && (
        <p className="cap-notice">ℹ️ {score.capApplied}</p>
      )}

      <div className="scan-result-section">
        <h2>Ingredient breakdown</h2>
        <IngredientList ingredients={ingredients} />
      </div>

      {/* Gemini AI insights for unrecognized ingredients */}
      {geminiInsights && geminiInsights.insights.length > 0 && (
        <div className="scan-result-section gemini-section">
          <h2>
            AI analysis of unrecognized ingredients
            <span className="ai-badge">Gemini AI</span>
          </h2>
          <p className="gemini-disclaimer">{geminiInsights.disclaimer}</p>
          <div className="gemini-insights">
            {geminiInsights.insights.map((insight, i) => (
              <div key={i} className={`gemini-card signal-${insight.safetySignal}`}>
                <div className="gemini-card-header">
                  <span className="gemini-ingredient-name">{insight.name}</span>
                  <span className={`gemini-signal signal-badge-${insight.safetySignal}`}>
                    {insight.safetySignal.replace("-", " ")}
                  </span>
                  <span className="gemini-confidence">({insight.confidence} confidence)</span>
                </div>
                <p className="gemini-category">{insight.likelyCategoryGuess}</p>
                <p className="gemini-reasoning">{insight.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {alternativeGuidance.suggestions.length > 0 && (
        <div className="scan-result-section">
          <h2>What to look for instead</h2>
          <p className="alt-honesty-note">{alternativeGuidance.honestyNote}</p>
          <div className="alt-suggestions">
            {alternativeGuidance.suggestions.map((s, i) => (
              <div key={i} className="alt-card">
                <p className="alt-trigger">Because of: <strong>{s.triggeredBy}</strong></p>
                <p className="alt-lookfor">Look for: {s.lookFor.join(", ")}</p>
                <p className="alt-why">{s.why}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="dataset-footer">
        Checked against {datasetInfo.totalIngredients.toLocaleString()} ingredient entries and{" "}
        {datasetInfo.flaggedIngredientCount} curated safety flags · last reviewed {datasetInfo.lastReviewed}.
        This is not medical advice.
      </p>
    </div>
  );
}
