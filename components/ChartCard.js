import styles from "./ChartCard.module.css";

export default function ChartCard({ title, subtitle, children }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}
