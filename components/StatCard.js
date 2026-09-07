import styles from "./StatCard.module.css";

export default function StatCard({ label, value, icon, delta }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.label}>{label}</p>
        {icon && <span className={styles.iconBox}>{icon}</span>}
      </div>
      <p className={styles.value}>{value}</p>
      {delta && (
        <p className={`${styles.delta} ${delta.positive ? styles.deltaPositive : styles.deltaNegative}`}>
          {delta.positive ? "↑" : "↓"} {delta.text}
        </p>
      )}
    </div>
  );
}
