import styles from "./MachineUsageList.module.css";

const hoursFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function MachineUsageList({ machines }) {
  const maxHours = Math.max(0, ...machines.map((machine) => machine.todayHours)) || 1;

  return (
    <div className={styles.list}>
      {machines.map((machine) => (
        <div key={machine.name} className={styles.row}>
          <div className={styles.info}>
            <p className={styles.name}>{machine.name}</p>
            <p className={styles.subtitle}>{hoursFormatter.format(machine.weekHours)} hrs this week</p>
          </div>
          <div className={styles.track} aria-hidden="true">
            <div className={styles.fill} style={{ width: `${(machine.todayHours / maxHours) * 100}%` }} />
          </div>
          <span className={styles.count}>{hoursFormatter.format(machine.todayHours)} h</span>
        </div>
      ))}
    </div>
  );
}
