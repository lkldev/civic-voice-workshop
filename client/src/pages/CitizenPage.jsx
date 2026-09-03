import { useState } from "react";
import { submitFeedback, synthesizeSpeech } from "../api";
import { limitFeedbackLength, MAX_FEEDBACK_LENGTH } from "../feedback";

export function CitizenPage({ session }) {
  const { user } = session;
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [speech, setSpeech] = useState({ status: "idle", audio: "", error: "" });
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!message.trim()) {
      setError("Please enter feedback.");
      return;
    }
    const messageToSubmit = message;
    try {
      await submitFeedback({ nric: user.nric, name: user.name, message: messageToSubmit });
      setSubmitted(true);
      setSubmittedMessage(messageToSubmit);
      setSpeech({ status: "idle", audio: "", error: "" });
      setMessage("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleReadAloud() {
    if (!submittedMessage.trim()) {
      setSpeech({ status: "error", audio: "", error: "There is no feedback to read aloud." });
      return;
    }
    setSpeech({ status: "loading", audio: "", error: "" });
    try {
      const response = await synthesizeSpeech(submittedMessage, session);
      setSpeech({
        status: "ready",
        audio: `data:${response.contentType ?? "audio/mpeg"};base64,${response.audio}`,
        error: "",
      });
    } catch (requestError) {
      setSpeech({ status: "error", audio: "", error: requestError.message });
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
        {submitted && (
          <div className="success-banner">
            <div>Thank you. Your feedback has been received.</div>
            <div className="speech-controls">
              <button className="secondary-button" type="button" onClick={handleReadAloud} disabled={speech.status === "loading"}>
                {speech.status === "loading" ? "Generating audio…" : "Read feedback aloud"}
              </button>
              {speech.audio && <audio className="audio-player" controls src={speech.audio}>Your browser cannot play this audio.</audio>}
              {speech.error && <p className="error-message" role="alert">{speech.error}</p>}
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
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
