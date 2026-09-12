import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import "./Profile.css";

const SKIN_TYPES = [
  { value: "normal", label: "Normal", desc: "Balanced — not too oily or dry" },
  { value: "dry", label: "Dry", desc: "Tight, flaky, or rough texture" },
  { value: "oily", label: "Oily", desc: "Shiny, enlarged pores" },
  { value: "combination", label: "Combination", desc: "Oily T-zone, dry cheeks" },
  { value: "sensitive", label: "Sensitive", desc: "Easily irritated, reactive" },
  { value: "acne-prone", label: "Acne-prone", desc: "Frequent breakouts or congestion" },
];

const ENVIRONMENTS = [
  { value: "none", label: "No specific factor" },
  { value: "high-humidity", label: "High humidity" },
  { value: "dry-arid", label: "Dry / arid climate" },
  { value: "high-uv", label: "High UV exposure" },
  { value: "pollution-heavy", label: "Heavy pollution / urban air" },
];

const CONCERNS = [
  "acne", "sensitivity", "hyperpigmentation", "dryness", "oiliness",
  "anti-aging", "redness", "dark circles", "large pores",
];

export default function Profile() {
  const { profile, saveProfile, loggedIn } = useAuth();
  const [skinType, setSkinType] = useState("normal");
  const [environment, setEnvironment] = useState("none");
  const [concerns, setConcerns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (profile) {
      setSkinType(profile.skinType || "normal");
      setEnvironment(profile.environment || "none");
      setConcerns(profile.concerns || []);
    }
  }, [profile]);

  function toggleConcern(c) {
    setConcerns((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveProfile({ skinType, environment, concerns });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!loggedIn) {
    return (
      <div className="profile-page">
        <p className="profile-login-prompt">
          <a href="/login">Log in or sign up</a> to save your skin profile across sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Your skin profile</h1>
        <p className="profile-subtitle">
          Your profile changes how Ambrosia weights ingredient scores — the same product can
          score very differently depending on your skin type and environment. This is what makes
          the personalization real, not just decorative.
        </p>
      </div>

      <form className="profile-form" onSubmit={handleSave}>
        <div className="profile-section">
          <h2>Skin type</h2>
          <div className="skin-type-grid">
            {SKIN_TYPES.map((s) => (
              <label key={s.value} className={`skin-type-card ${skinType === s.value ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="skinType"
                  value={s.value}
                  checked={skinType === s.value}
                  onChange={() => setSkinType(s.value)}
                />
                <span className="skin-type-label">{s.label}</span>
                <span className="skin-type-desc">{s.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="profile-section">
          <h2>Environment</h2>
          <p className="profile-section-hint">
            Affects weighting for phototoxic, irritant, and comedogenic flags.
          </p>
          <div className="env-options">
            {ENVIRONMENTS.map((env) => (
              <label key={env.value} className={`env-pill ${environment === env.value ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="environment"
                  value={env.value}
                  checked={environment === env.value}
                  onChange={() => setEnvironment(env.value)}
                />
                {env.label}
              </label>
            ))}
          </div>
        </div>

        <div className="profile-section">
          <h2>Skin concerns <span className="optional-tag">optional</span></h2>
          <div className="concerns-grid">
            {CONCERNS.map((c) => (
              <label key={c} className={`concern-chip ${concerns.includes(c) ? "selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={concerns.includes(c)}
                  onChange={() => toggleConcern(c)}
                />
                {c.replace(/-/g, " ")}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="scan-error">{error}</p>}
        {saved && <p className="profile-saved">Profile saved!</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
