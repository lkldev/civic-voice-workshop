import { useEffect, useState } from "react";
import { getFeedback, translateFeedback } from "../api";

export function AdminPage({ session }) {
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");
  const [translations, setTranslations] = useState({});

  useEffect(() => {
    getFeedback(session).then((response) => setFeedback(response.feedback)).catch((requestError) => setError(requestError.message));
  }, [session]);

  async function handleTranslate(item) {
    setTranslations((current) => ({ ...current, [item.id]: { status: "loading" } }));
    try {
      const response = await translateFeedback(item.id, session);
      setTranslations((current) => ({
        ...current,
        [item.id]: { status: "ready", translation: response.translation },
      }));
    } catch (requestError) {
      setTranslations((current) => ({
        ...current,
        [item.id]: { status: "error", error: requestError.message },
      }));
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
              <div className="feedback-original">
                <strong>Original</strong>
                <p>{item.message}</p>
              </div>
              <div className="translation-controls">
                <button className="secondary-button" type="button" onClick={() => handleTranslate(item)} disabled={translations[item.id]?.status === "loading"}>
                  {translations[item.id]?.status === "loading" ? "Translating…" : "Translate to English"}
                </button>
                {translations[item.id]?.status === "error" && <p className="error-message" role="alert">{translations[item.id].error}</p>}
                {translations[item.id]?.status === "ready" && (
                  <div className="translation-result">
                    <strong>English translation</strong>
                    <p>{translations[item.id].translation}</p>
                  </div>
                )}
              </div>
            </div>
            <span className="status-pill">{item.status}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
