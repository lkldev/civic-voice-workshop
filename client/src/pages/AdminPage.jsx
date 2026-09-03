import { useEffect, useState } from "react";
import { getFeedback, updateFeedbackStatus } from "../api";

export function AdminPage({ session }) {
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    getFeedback(session).then((response) => setFeedback(response.feedback)).catch((requestError) => setError(requestError.message));
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

  return (
    <main className="page-shell admin-shell">
      <div className="page-heading">
        <div className="eyebrow">Admin workspace</div>
        <h1>Feedback inbox</h1>
        <p>A simple view of feedback received from members of the public.</p>
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
