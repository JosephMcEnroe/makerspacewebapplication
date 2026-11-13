import { useEffect, useId, useRef, useState } from "react";
import { isEmbedVideo } from "@/lib/trainingContent";
import styles from "./TrainingModal.module.css";

// Shows a training module (video and/or reading) and makes the member tick a
// confirmation box before submitting it for staff approval.
export default function TrainingModal({ module, onClose, onSubmit }) {
  const titleId = useId();
  const checkboxId = useId();
  const closeButtonRef = useRef(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Lock page scroll behind the modal and move focus into it
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => event.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(module.key);
    } catch (err) {
      setError(err.message || "Could not save your training.");
      setSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Equipment training · {module.duration}</p>
            <h2 id={titleId} className={styles.title}>{module.name}</h2>
            <p className={styles.model}>{module.model}</p>
          </div>
          <button ref={closeButtonRef} type="button" className={styles.closeBtn} onClick={onClose} disabled={saving} aria-label="Close training">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {module.videoUrl && (
            <div className={styles.video}>
              {isEmbedVideo(module.videoUrl) ? (
                <iframe
                  src={module.videoUrl}
                  title={`${module.name} training video`}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <video src={module.videoUrl} controls preload="metadata" />
              )}
            </div>
          )}

          {module.sections.map((section) => (
            <section key={section.heading} className={styles.section}>
              <h3 className={styles.sectionHeading}>{section.heading}</h3>
              <ul className={styles.points}>
                {section.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </section>
          ))}
        </div>

        <footer className={styles.footer}>
          <label htmlFor={checkboxId} className={styles.checkboxRow}>
            <input
              id={checkboxId}
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={saving}
            />
            <span>
              I confirm I completed the {module.name} training above and will follow these safety rules.
            </span>
          </label>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={!confirmed || saving}>
              {saving ? "Submitting…" : "Submit for Approval"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
