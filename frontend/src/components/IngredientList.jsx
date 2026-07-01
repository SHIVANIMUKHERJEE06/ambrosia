import { useState } from "react";
import "./IngredientList.css";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function IngredientList({ ingredients }) {
  const [filter, setFilter] = useState("all"); // all | flagged | unrecognized

  const sorted = [...ingredients].sort((a, b) => {
    const aSev = a.safetyFlag ? SEVERITY_ORDER[a.safetyFlag.severity] : 99;
    const bSev = b.safetyFlag ? SEVERITY_ORDER[b.safetyFlag.severity] : 99;
    if (aSev !== bSev) return aSev - bSev;
    if (a.recognized !== b.recognized) return a.recognized ? 1 : -1;
    return 0;
  });

  const filtered = sorted.filter((i) => {
    if (filter === "flagged") return !!i.safetyFlag;
    if (filter === "unrecognized") return !i.recognized;
    return true;
  });

  const flaggedCount = ingredients.filter((i) => i.safetyFlag).length;
  const unrecognizedCount = ingredients.filter((i) => !i.recognized).length;

  return (
    <div className="ingredient-list">
      <div className="ingredient-list-filters">
        <button
          className={filter === "all" ? "filter-pill active" : "filter-pill"}
          onClick={() => setFilter("all")}
        >
          All ({ingredients.length})
        </button>
        <button
          className={filter === "flagged" ? "filter-pill active" : "filter-pill"}
          onClick={() => setFilter("flagged")}
          disabled={flaggedCount === 0}
        >
          Flagged ({flaggedCount})
        </button>
        <button
          className={filter === "unrecognized" ? "filter-pill active" : "filter-pill"}
          onClick={() => setFilter("unrecognized")}
          disabled={unrecognizedCount === 0}
        >
          Unrecognized ({unrecognizedCount})
        </button>
      </div>

      <ul className="ingredient-items">
        {filtered.map((ing, idx) => (
          <IngredientRow key={idx} ingredient={ing} />
        ))}
      </ul>
    </div>
  );
}

function IngredientRow({ ingredient }) {
  const { rawInput, recognized, safetyFlag, comedogenicScore, matchType, resolvedInci } = ingredient;

  let statusClass = "ingredient-row";
  if (safetyFlag) statusClass += ` severity-${safetyFlag.severity}`;
  else if (!recognized) statusClass += " unrecognized";

  return (
    <li className={statusClass}>
      <div className="ingredient-row-main">
        <span className="ingredient-name">{rawInput}</span>
        {!recognized && (
          <span className="ingredient-badge badge-unrecognized">Not in database</span>
        )}
        {recognized && matchType === "fuzzy" && (
          <span className="ingredient-badge badge-fuzzy">
            Matched to "{resolvedInci}" ({Math.round(ingredient.matchConfidence * 100)}% confidence)
          </span>
        )}
        {safetyFlag && (
          <span className={`ingredient-badge badge-${safetyFlag.severity}`}>
            {safetyFlag.severity}
          </span>
        )}
        {comedogenicScore !== null && comedogenicScore >= 3 && (
          <span className="ingredient-badge badge-comedogenic">
            Comedogenic {comedogenicScore}/5
          </span>
        )}
      </div>
      {safetyFlag && <p className="ingredient-reason">{safetyFlag.reason}</p>}
      {!recognized && (
        <p className="ingredient-reason ingredient-reason-muted">
          We couldn't confidently match this to a known ingredient. It is not assumed safe — it's
          simply unverified. Consider checking it manually.
        </p>
      )}
    </li>
  );
}
