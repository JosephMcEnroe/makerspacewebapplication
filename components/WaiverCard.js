import { useState } from "react";
import { useAuthContext } from "@/context/AuthContext";
import styles from "./WaiverCard.module.css";

// Placeholder wording - replace with the studio's actual liability waiver
const WAIVER_TEXT = [
  "I understand that using tools, machines, and equipment at The Crafty Studio involves risk of injury and property damage.",
  "I agree to follow all posted safety rules and staff instructions, to use only equipment I have been trained on, and to wear required protective gear.",
  "I accept responsibility for my own safety and release The Crafty Studio, its staff, and volunteers from liability for injuries or damages arising from my use of the space, except where caused by their gross negligence.",
];

export default function WaiverCard({ initiallySigned }) {
  const { user, setUser } = useAuthContext();
  const [signed, setSigned] = useState(initiallySigned);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const csrfResponse = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfResponse.json();
      const response = await fetch("/api/account/waiver", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ agreed, signature }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your waiver.");
      setSigned(true);
      // Hides the "complete your waiver" banner
      if (user) setUser({ ...user, waiverSigned: true });
    } catch (err) {
      setError(err.message || "Could not save your waiver.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="waiver" className={styles.card} aria-labelledby="waiver-title">
      <div className={styles.header}>
        <h2 id="waiver-title" className={styles.cardTitle}>Liability Waiver</h2>
        <span className={signed ? styles.statusSigned : styles.statusPending}>
          {signed ? "Completed" : "Not completed"}
        </span>
      </div>

      {signed ? (
        <p className={styles.signedText}>
          Thanks! Your waiver is on file. Contact staff if you need to make changes.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className={styles.intro}>You need to complete this waiver before using the studio.</p>
          <div className={styles.waiverText}>
            {WAIVER_TEXT.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>

          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            I have read and agree to the waiver above.
          </label>

          <label htmlFor="waiverSignature" className={styles.label}>Type your full name to sign</label>
          <input
            id="waiverSignature"
            className={styles.input}
            value={signature}
            onChange={(event) => setSignature(event.target.value)}
            autoComplete="name"
            maxLength={120}
            required
          />

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button type="submit" className={styles.signBtn} disabled={!agreed || !signature.trim() || saving}>
            {saving ? "Saving…" : "Sign Waiver"}
          </button>
        </form>
      )}
    </section>
  );
}
