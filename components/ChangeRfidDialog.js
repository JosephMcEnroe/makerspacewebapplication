import { useEffect, useRef, useState } from "react";
import { staffRequest } from "@/lib/staffApi";
import styles from "@/styles/StaffPages.module.css";

// Staff/admin modal for replacing (or clearing) a member's RFID card
export default function ChangeRfidDialog({ memberId, memberName, currentRfid, onClose, onSaved }) {
  const [rfid, setRfid] = useState(currentRfid);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element.open) element.showModal();
    input.current?.select();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; element.close(); };
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await staffRequest(`/api/staff/members/${memberId}`, "PATCH", { rfid: { rfid_id: rfid } });
      onSaved(rfid.trim());
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className={styles.modal} aria-labelledby="change-rfid-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <form onSubmit={save}>
        <header className={styles.modalHeader}>
          <div>
            <span className={styles.modalEyebrow}>Member access</span>
            <h2 id="change-rfid-title" className={styles.modalTitle}>Change RFID card</h2>
          </div>
          <button type="button" className={styles.modalClose} aria-label="Close" disabled={busy} onClick={onClose}>×</button>
        </header>
        <div className={styles.modalBody}>
          <p className={styles.modalText}>
            Enter the new RFID card number for {memberName}. Saving will replace the current card number.
            Leave it blank to remove the card.
          </p>
          <label className={styles.field}>
            RFID card number
            <input ref={input} className={styles.input} value={rfid} onChange={(event) => setRfid(event.target.value)}
              placeholder="Scan or type the card ID" maxLength={64} autoComplete="off" />
          </label>
          {error && <p className={styles.error} role="alert" style={{ marginTop: "1rem", marginBottom: 0 }}>{error}</p>}
        </div>
        <footer className={styles.modalFooter}>
          <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.primaryBtn} disabled={busy || rfid.trim() === currentRfid}>
            {busy ? "Saving…" : "Save RFID"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
