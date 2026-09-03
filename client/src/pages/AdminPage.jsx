import { useEffect, useState } from "react";
import { getFeedback, summarizeFeedback, updateFeedbackStatus } from "../api";

export function AdminPage({ session }) {
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [summaryBusy, setSummaryBusy] = useState("");
  const [summaryErrors, setSummaryErrors] = useState({});

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
      {error && <p className="error-message">{error}</p>}
      <section className="feedback-list">
        <div className="list-header"><strong>Latest feedback</strong><span>{feedback.length} items</span></div>
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
      </section>
    </main>
  );
}
