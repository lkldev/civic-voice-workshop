import { useEffect, useState } from "react";
import { getFeedback } from "../api";

export function AdminPage({ session }) {
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setError("");
    getFeedback(session, { category, status })
      .then((response) => setFeedback(response.feedback))
      .catch((requestError) => setError(requestError.message));
  }, [session, category, status]);

  function clearFilters() {
    setCategory("");
    setStatus("");
  }

  return (
    <main className="page-shell admin-shell">
      <div className="page-heading">
        <div className="eyebrow">Admin workspace</div>
        <h1>Feedback inbox</h1>
      <p>A simple view of feedback received from members of the public.</p>
      </div>
      <div className="filter-bar">
        <label>Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            <option>Estate</option>
            <option>Transport</option>
            <option>Environment</option>
            <option>Other</option>
            <option>General</option>
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option>New</option>
            <option>In review</option>
            <option>Closed</option>
          </select>
        </label>
        <button className="text-button" type="button" onClick={clearFilters} disabled={!category && !status}>Clear filters</button>
      </div>
      {error && <p className="error-message">{error}</p>}
      <section className="feedback-list">
        <div className="list-header"><strong>Latest feedback</strong><span>{feedback.length} items</span></div>
        {feedback.map((item) => (
          <article className="feedback-row" key={item.id}>
            <div>
              <div className="feedback-meta">{item.name} · {new Date(item.createdAt).toLocaleDateString()}</div>
              <p>{item.message}</p>
            </div>
            <span className="status-pill">{item.status}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
