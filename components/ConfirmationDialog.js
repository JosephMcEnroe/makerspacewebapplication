import { useEffect, useId, useRef } from "react";
import styles from "./ConfirmationDialog.module.css";
import buttonStyles from "./WeeklyAvailability.module.css";

export default function ConfirmationDialog({ title, children, confirmLabel, cancelLabel = "Go back", onConfirm, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  function dismiss(action) {
    dialog.current.close();
    action();
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        dismiss(onClose);
      }}
    >
      <h2 id={titleId} className={styles.title}>{title}</h2>
      <p id={descriptionId} className={styles.description}>{children}</p>
      <footer className={styles.actions}>
        <button type="button" className={buttonStyles.secondaryButton} onClick={() => dismiss(onClose)}>{cancelLabel}</button>
        <button type="button" className={buttonStyles.primaryButton} onClick={() => dismiss(onConfirm)}>{confirmLabel}</button>
      </footer>
    </dialog>
  );
}
