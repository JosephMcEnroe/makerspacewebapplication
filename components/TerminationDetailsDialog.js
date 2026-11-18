import { useEffect, useRef, useState } from "react";
import styles from "@/styles/StaffPages.module.css";

export default function TerminationDetailsDialog({ memberId, onClose }) {
  const dialog = useRef(null);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    const controller = new AbortController();

    async function loadDetails() {
      try {
        const res = await fetch(`/api/staff/members/${memberId}/termination`, { signal: controller.signal });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error(data?.error || "Could not load termination details.");
        setDetails(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message || "Could not load termination details.");
      }
    }

    loadDetails();
    return () => {
      controller.abort();
      element.close();
    };
  }, [memberId]);

  return (
    <dialog ref={dialog} className={styles.modal} aria-labelledby="termination-details-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className={styles.modalHeader}>
        <h2 id="termination-details-title" className={styles.modalTitle}>Termination Details</h2>
        <button type="button" className={styles.modalClose} aria-label="Close" onClick={onClose}>×</button>
      </header>
      <div className={styles.modalBody}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!details && !error && <p className={styles.modalText} role="status">Loading termination details…</p>}
        {details && (
          <>
            {details.photoUrl && !photoFailed && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.terminationDetailsPhoto} src={details.photoUrl}
                alt="Member photo on file" onError={() => setPhotoFailed(true)} />
            )}
            <p className={styles.terminationDetailsReason}><strong>Reason:</strong> {details.reason}</p>
          </>
        )}
      </div>
    </dialog>
  );
}
