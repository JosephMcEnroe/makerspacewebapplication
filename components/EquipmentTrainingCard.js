import { useCallback, useState } from "react";
import TrainingModal from "@/components/TrainingModal";
import { staffRequest } from "@/lib/staffApi";
import { formatDate } from "@/lib/format";
import { TRAINING_MODULES } from "@/lib/trainingContent";
import styles from "./EquipmentTrainingCard.module.css";

const STATUS_INFO = {
  APPROVED: { label: "Completed", className: styles.statusDone, action: "Training Completed" },
  PENDING: { label: "Pending approval", className: styles.statusPending, action: "Awaiting Approval" },
  DENIED: { label: "Not approved", className: styles.statusDenied },
  NONE: { label: "Training required", className: styles.statusRequired },
};

// Account page list of equipment trainings. "Start Training" opens the module
// in a modal; once confirmed it goes to staff for approval.
// trainings: { [equipmentKey]: { status, completedAt } }
export default function EquipmentTrainingCard({ trainings: initialTrainings }) {
  const [trainings, setTrainings] = useState(initialTrainings);
  const [activeModule, setActiveModule] = useState(null);

  const closeModal = useCallback(() => setActiveModule(null), []);

  const submitTraining = async (equipmentKey) => {
    // staffRequest is just a CSRF-aware JSON fetch; the endpoint is member-facing
    await staffRequest("/api/account/training", "POST", { equipmentKey, confirmed: true });
    setTrainings((current) => ({
      ...current,
      [equipmentKey]: { status: "PENDING", completedAt: new Date().toISOString() },
    }));
    setActiveModule(null);
  };

  return (
    <section id="training" className={styles.card} aria-labelledby="training-title">
      <h2 id="training-title" className={styles.cardTitle}>Equipment Training</h2>
      <p className={styles.intro}>Complete required training before reserving studio equipment. Staff review each training before it counts.</p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Equipment</th>
              <th scope="col">Training status</th>
              <th scope="col">Completed</th>
              <th scope="col">Training session</th>
            </tr>
          </thead>
          <tbody>
            {TRAINING_MODULES.map((module) => {
              const record = trainings[module.key];
              const info = STATUS_INFO[record?.status] || STATUS_INFO.NONE;
              return (
                <tr key={module.key}>
                  <td data-label="Equipment">
                    <div className={styles.equipmentName}>{module.name}</div>
                    <div className={styles.equipmentModel}>{module.model}</div>
                  </td>
                  <td data-label="Status">
                    <span className={`${styles.status} ${info.className}`}>{info.label}</span>
                  </td>
                  <td data-label="Completed" className={styles.date}>
                    {record?.status === "APPROVED" ? formatDate(record.completedAt) : "—"}
                  </td>
                  <td data-label="Session">
                    {info.action ? (
                      <button type="button" className={styles.actionBtn} disabled>{info.action}</button>
                    ) : (
                      <button type="button" className={styles.actionBtn} onClick={() => setActiveModule(module)}>
                        {record?.status === "DENIED" ? "Retake Training" : "Start Training"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeModule && (
        <TrainingModal module={activeModule} onClose={closeModal} onSubmit={submitTraining} />
      )}
    </section>
  );
}
