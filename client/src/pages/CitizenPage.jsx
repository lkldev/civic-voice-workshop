import { useState } from "react";
import { submitFeedback } from "../api";
import { limitFeedbackLength, MAX_FEEDBACK_LENGTH } from "../feedback";

const CATEGORIES = ["Estate", "Transport", "Environment", "Other"];

export function CitizenPage({ user }) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("Estate");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!message.trim()) {
      setError("Please enter feedback.");
      return;
    }
    try {
      await submitFeedback({ nric: user.nric, name: user.name, message, category });
      setSubmitted(true);
      setMessage("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <div className="eyebrow">Public feedback</div>
        <h1>What would you like us to know?</h1>
        <p>Tell us about an issue, an idea, or a positive experience in your community.</p>
      </div>
      <section className="form-card">
        {submitted && <div className="success-banner">Thank you. Your feedback has been received.</div>}
        <form onSubmit={handleSubmit}>
          <label>Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>Your feedback
            <textarea
              rows="7"
              value={message}
              maxLength={MAX_FEEDBACK_LENGTH}
              onChange={(event) => setMessage(limitFeedbackLength(event.target.value))}
              placeholder="Share your feedback here..."
            />
          </label>
          <div className="form-footer">
            <div>
              <span className="muted">Please do not include sensitive personal information.</span>
              <div className="muted">{message.length} / {MAX_FEEDBACK_LENGTH} characters</div>
            </div>
            <button className="primary-button">Submit feedback</button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </form>
      </section>
    </main>
  );
}
