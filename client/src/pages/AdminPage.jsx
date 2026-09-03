import { useEffect, useState } from "react";
import { getFeedback, summarizeFeedback, updateFeedbackStatus } from "../api";

export function AdminPage({ session }) {
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [summaryBusy, setSummaryBusy] = useState("");
  const [summaryErrors, setSummaryErrors] = useState({});
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, totalItems: 0, totalPages: 1 });
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    getFeedback(session, { page, category, status })
      .then((response) => {
        setFeedback(response.feedback);
        setPagination(response.pagination);
      })
      .catch((requestError) => setError(requestError.message));
  }, [session, page, category, status]);

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  async function handleStatusChange(id, status) {
    setError("");
    setUpdatingId(id);
    try {
      const response = await updateFeedbackStatus(session, id, status);
      setFeedback((items) => items.map((item) => item.id === id ? response.feedback : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingId("");
    }
  }

  async function handleSummarize(item) {
    setSummaryBusy(item.id);
    setSummaryErrors((current) => ({ ...current, [item.id]: "" }));
    try {
      const response = await summarizeFeedback(item.id, session);
      setFeedback((current) => current.map((candidate) => (
        candidate.id === item.id ? response.feedback : candidate
      )));
    } catch (requestError) {
      setSummaryErrors((current) => ({ ...current, [item.id]: requestError.message }));
    } finally {
      setSummaryBusy("");
    }
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
          <select value={category} onChange={(event) => changeFilter(setCategory, event.target.value)}>
            <option value="">All categories</option>
            <option>Estate</option>
            <option>Transport</option>
            <option>Environment</option>
            <option>Other</option>
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(event) => changeFilter(setStatus, event.target.value)}>
            <option value="">All statuses</option>
            <option>New</option>
            <option>In review</option>
            <option>Closed</option>
          </select>
        </label>
        <button className="text-button" type="button" onClick={() => { setCategory(""); setStatus(""); setPage(1); }} disabled={!category && !status}>Clear filters</button>
      </div>
      {error && <p className="error-message">{error}</p>}
      <section className="feedback-list">
        <div className="list-header"><strong>Latest feedback</strong><span>{pagination.totalItems} items</span></div>
        {feedback.map((item) => (
          <article className="feedback-row" key={item.id}>
            <div>
              <div className="feedback-meta">{item.name} · {new Date(item.createdAt).toLocaleDateString()}</div>
              <p>{item.message}</p>
              {item.summary && <p className="feedback-summary"><strong>Summary:</strong> {item.summary}</p>}
              {item.message.length > 200 && !item.summary && (
                <div className="feedback-actions">
                  <button
                    className="secondary-button"
                    disabled={summaryBusy === item.id}
                    onClick={() => handleSummarize(item)}
                    type="button"
                  >
                    {summaryBusy === item.id ? "Summarizing…" : "Summarize"}
                  </button>
                  {summaryErrors[item.id] && <span className="error-message">{summaryErrors[item.id]}</span>}
                </div>
              )}
            </div>
            <select
              className="status-select"
              value={item.status}
              disabled={updatingId === item.id}
              onChange={(event) => handleStatusChange(item.id, event.target.value)}
              aria-label={`Status for feedback from ${item.name}`}
            >
              <option>New</option>
              <option>In review</option>
              <option>Closed</option>
            </select>
          </article>
        ))}
        <div className="pagination-controls">
          <button className="secondary-button" type="button" disabled={pagination.page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
          <span className="muted">Page {pagination.page} of {pagination.totalPages}</span>
          <button className="secondary-button" type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>
      </section>
    </main>
  );
}
