import { useEffect, useState } from "react";
import { exportFeedback, getFeedback, updateFeedbackStatus } from "../api";

export function AdminPage({ session }) {
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [category, setCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getFeedback(session).then((response) => setFeedback(response.feedback)).catch((requestError) => setError(requestError.message));
  }, [session]);

  const visibleFeedback = feedback.filter((item) => (
    (!category || item.category === category) && (!filterStatus || item.status === filterStatus)
  ));

  async function handleExport() {
    setError("");
    setExporting(true);
    try {
      const blob = await exportFeedback(session, { category, status: filterStatus });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "feedback.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExporting(false);
    }
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
          </select>
        </label>
        <label>Status
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option>New</option>
            <option>In review</option>
            <option>Closed</option>
          </select>
        </label>
        <button className="secondary-button" type="button" onClick={handleExport} disabled={exporting}>
          {exporting ? "Preparing CSV…" : "Export CSV"}
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
      <section className="feedback-list">
        <div className="list-header"><strong>Latest feedback</strong><span>{visibleFeedback.length} items</span></div>
        {visibleFeedback.map((item) => (
          <article className="feedback-row" key={item.id}>
            <div>
              <div className="feedback-meta">{item.name} · {new Date(item.createdAt).toLocaleDateString()}</div>
              <p>{item.message}</p>
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
