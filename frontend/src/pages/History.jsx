import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth.jsx";
import "./History.css";

export default function History() {
  const { loggedIn } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loggedIn) { setLoading(false); return; }
    api.getHistory()
      .then((data) => setHistory(data.history))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div className="history-page">
        <p className="history-empty">
          <Link to="/login">Log in</Link> to see your saved scan history.
        </p>
      </div>
    );
  }

  return (
    <div className="history-page">
      <h1>Scan history</h1>
      {loading && <p className="history-loading">Loading…</p>}
      {error && <p className="scan-error">{error}</p>}
      {!loading && history.length === 0 && (
        <div className="history-empty-state">
          <p>No saved scans yet.</p>
          <Link to="/scan" className="btn-primary">Scan your first product</Link>
        </div>
      )}
      {history.length > 0 && (
        <ul className="history-list">
          {history.map((item) => (
            <HistoryCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function scoreColor(score) {
  if (score >= 80) return "var(--color-sage)";
  if (score >= 60) return "var(--color-honey)";
  return "var(--color-clay)";
}

function HistoryCard({ item }) {
  const score = item.scoreResult?.score;
  const verdict = item.scoreResult?.verdict;
  // BUG FIX 9: Use browser locale, not hardcoded "en-IN"
  const date = new Date(item.createdAt).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <li className="history-card">
      <div className="history-score" style={{ color: scoreColor(score) }}>
        {score}
      </div>
      <div className="history-info">
        <p className="history-name">{item.productName || "Unnamed product"}</p>
        <p className="history-verdict">{verdict}</p>
        <p className="history-date">{date}</p>
      </div>
    </li>
  );
}
