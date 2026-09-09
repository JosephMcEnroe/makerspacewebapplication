import Link from "next/link";
import styles from "./ActionCard.module.css";

export default function ActionCard({ icon, title, description, href, onClick }) {
  const content = (
    <>
      <span className={styles.iconBox}>{icon}</span>
      <span className={styles.title}>{title}</span>
      <span className={styles.description}>{description}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.card}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={styles.card} onClick={onClick}>
      {content}
    </button>
  );
}
