import styles from "./MachineUsageList.module.css";

export default function MachineUsageList({ machines }) {
  return (
    <div className={styles.list}>
      {machines.map((machine) => (
        <div key={machine.name} className={styles.row}>
          <div className={styles.info}>
            <p className={styles.name}>{machine.name}</p>
            <p className={styles.subtitle}>{machine.subtitle}</p>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${machine.percent}%` }} />
          </div>
          <span className={styles.percent}>{machine.percent}%</span>
        </div>
      ))}
    </div>
  );
}
