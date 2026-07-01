import "./ScoreStamp.css";

function scoreColor(score, confidence) {
  if (confidence === "low") return "var(--color-text-muted)";
  if (score >= 80) return "var(--color-sage)";
  if (score >= 60) return "var(--color-honey)";
  return "var(--color-clay)";
}

export default function ScoreStamp({ scoreResult, coverage }) {
  const { score, confidence, verdict, deductions, capApplied } = scoreResult;
  const ringColor = scoreColor(score, confidence);
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference * (1 - score / 100);

  // Verify deductions sum = actual drop for display (Issue 1 fix already in backend,
  // but we also show the cap notice in the UI if it was triggered)
  const deductionSum = deductions?.reduce((a, b) => a + (b.pointsDeducted || 0), 0) || 0;

  return (
    <div className="score-stamp">
      <div className="score-stamp-ring-wrap">
        <svg viewBox="0 0 120 120" className="score-stamp-ring">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-line)" strokeWidth="8" />
          <circle cx="60" cy="60" r="54" fill="none"
            stroke={ringColor} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="score-stamp-number">
          <span className="score-stamp-value">{score}</span>
          <span className="score-stamp-max">/100</span>
        </div>
      </div>

      <div className="score-stamp-detail">
        <p className="score-stamp-verdict">{verdict}</p>
        <p className="score-stamp-confidence">
          Confidence: <strong>{confidence}</strong>
          {" · "}
          {coverage.recognizedPct}% of label verified ({coverage.recognized}/{coverage.total} ingredients)
        </p>
        {coverage.unrecognized > 0 && (
          <p className="score-stamp-warning">
            {coverage.unrecognized} ingredient{coverage.unrecognized !== 1 ? "s" : ""} unrecognized — already
            counted against this score, <strong>not</strong> assumed safe.
          </p>
        )}
        {capApplied && (
          <p className="score-stamp-cap">ℹ️ Penalty cap applied — {capApplied}</p>
        )}
      </div>
    </div>
  );
}
