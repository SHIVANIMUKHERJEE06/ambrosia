import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import "./Home.css";

export default function Home() {
  const [datasetInfo, setDatasetInfo] = useState(null);

  useEffect(() => {
    api.datasetInfo().then(setDatasetInfo).catch(() => {});
  }, []);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-inner">
          <span className="hero-eyebrow">An honest skincare ingredient checker</span>
          <h1 className="hero-title">
            Know exactly what's<br />in what you're putting on.
          </h1>
          <p className="hero-sub">
            Paste an ingredient list or snap a photo of the label. Ambrosia checks it against a
            real ingredient database, flags what's worth knowing, and tells you plainly when it
            isn't sure — instead of pretending to know everything.
          </p>
          <div className="hero-actions">
            <Link to="/scan" className="btn-primary">Scan a product</Link>
            <Link to="/about" className="btn-secondary">How it works</Link>
          </div>

          {datasetInfo && (
            <p className="hero-stat">
              Checking against <strong>{datasetInfo.totalIngredients.toLocaleString()}</strong> real
              ingredient entries · <strong>{datasetInfo.flaggedIngredientCount}</strong> curated safety
              flags · last reviewed {datasetInfo.lastReviewed}
            </p>
          )}
        </div>

        <div className="hero-visual" aria-hidden="true">
          <LabelIllustration />
        </div>
      </section>

      <section className="features">
        <FeatureCard
          title="Paste or photograph"
          body="Drop in a label's ingredient list as text, or take a photo and let OCR read it for you — always shown back to you for review before scoring."
        />
        <FeatureCard
          title="Honest about gaps"
          body="If an ingredient isn't recognized, we say so clearly and it counts against the score. We never quietly treat the unknown as safe."
        />
        <FeatureCard
          title="Personalized to you"
          body="Your skin type and environment change the actual math — the same product can score very differently for acne-prone versus dry skin."
        />
        <FeatureCard
          title="Catches interactions"
          body="Layering a retinoid with an acid exfoliant? We flag known interaction risks between products in your routine, not just single ingredients."
        />
      </section>
    </div>
  );
}

function FeatureCard({ title, body }) {
  return (
    <div className="feature-card">
      <h3 className="feature-title">{title}</h3>
      <p className="feature-body">{body}</p>
    </div>
  );
}

function LabelIllustration() {
  return (
    <div className="hero-logo-wrap">
      <img src="/logo.png" alt="Ambrosia" className="hero-logo-img" />
    </div>
  );
}
