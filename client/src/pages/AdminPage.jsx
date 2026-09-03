import { useEffect, useMemo, useState } from "react";
import { getFeedback, getFeedbackDetail, updateFeedbackStatus } from "../api";

const CATEGORIES = ["Estate", "Transport", "Environment", "Other", "General"];
const STATUSES = ["New", "In review", "Closed"];

export function AdminPage({ session }) {
  const [feedback, setFeedback] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    getFeedback(session)
      .then((response) => setFeedback(response.feedback))
      .catch((requestError) => setError(requestError.message));
  }, [session]);

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
  useEffect(() => {
    if (!selectedId) {
      setSelectedFeedback(null);
      return undefined;
    }
    setError("");
    getFeedbackDetail(session, selectedId)
      .then((response) => setSelectedFeedback(response.feedback))
      .catch((requestError) => setError(requestError.message));
    return undefined;
  }, [session, selectedId]);

  const visibleFeedback = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return feedback.filter((item) => (
      (!category || item.category === category) &&
      (!status || item.status === status) &&
      (!normalizedSearch || `${item.name} ${item.message}`.toLowerCase().includes(normalizedSearch))
    ));
  }, [feedback, search, category, status]);

  if (selectedId && selectedFeedback) {
    return (
      <main className="page-shell admin-shell">
        <button className="text-button back-button" type="button" onClick={() => setSelectedId("")}>← Back to inbox</button>
        <div className="page-heading">
          <div className="eyebrow">Feedback detail</div>
          <h1>{selectedFeedback.name}</h1>
        </div>
        <section className="form-card detail-card">
          <dl className="detail-fields">
            <div><dt>Reference</dt><dd>{selectedFeedback.reference ?? selectedFeedback.id}</dd></div>
            <div><dt>NRIC</dt><dd>{selectedFeedback.nric}</dd></div>
            <div><dt>Name</dt><dd>{selectedFeedback.name}</dd></div>
            <div><dt>Category</dt><dd>{selectedFeedback.category}</dd></div>
            <div><dt>Status</dt><dd>{selectedFeedback.status}</dd></div>
            <div><dt>Submitted</dt><dd>{new Date(selectedFeedback.createdAt).toLocaleString()}</dd></div>
          </dl>
          <div className="detail-message"><strong>Feedback</strong><p>{selectedFeedback.message}</p></div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell admin-shell">
      <div className="page-heading">
        <div className="eyebrow">Admin workspace</div>
        <h1>Feedback inbox</h1>
        <p>A simple view of feedback received from members of the public.</p>
      </div>
      <div className="filter-bar">
        <label>Search
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or feedback" />
        </label>
        <label>Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <button className="text-button" type="button" onClick={() => { setSearch(""); setCategory(""); setStatus(""); }} disabled={!search && !category && !status}>Clear</button>
      </div>
      {error && <p className="error-message">{error}</p>}
      <section className="feedback-list">
        <div className="list-header"><strong>Latest feedback</strong><span>{visibleFeedback.length} items</span></div>
        {visibleFeedback.length === 0 && <p className="muted">No feedback matches these filters.</p>}
        {visibleFeedback.map((item) => (
          <article className="feedback-row" key={item.id}>
            <div>
              <div className="feedback-meta">{item.name} · {new Date(item.createdAt).toLocaleDateString()}</div>
              <p>{item.message}</p>
              <button className="text-button detail-link" type="button" onClick={() => setSelectedId(item.id)}>View details</button>
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
      </section>
    </main>
  );
}
