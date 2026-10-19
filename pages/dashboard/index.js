import { useRouter } from "next/router";
import ReservationProductCard from "@/components/ReservationProductCard";
import Head from "next/head";
import ResourceCard from "@/components/ResourceCard";
import styles from "@/styles/Dashboard.module.css";
import Navbar from "@/components/Navbar";
import { loadClasses, loadEquipment, loadRooms } from "@/lib/resources";

export async function getServerSideProps() {
  const [equipment, rooms, classes] = await Promise.all([
    loadEquipment(),
    loadRooms(),
    loadClasses(),
  ]);

  return { props: { equipment, rooms, classes } };
}

export default function DashboardPage({ equipment, rooms, classes }) {
  const router = useRouter();
  return (
    <>
      <Head>
        <title>Dashboard - The Crafty Studio</title>
        <meta name="description" content="Browse equipment, rooms, and classes at The Crafty Studio" />
      </Head>
      <div className={styles.page}>
        <Navbar />
        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <h1 className={styles.sectionTitle}>Equipment</h1>
            <div className={styles.grid}>
              {equipment.map((item) => (
                <ReservationProductCard key={item.id} {...item} onSelect={() => router.push({ pathname: "/equipment", query: { resourceId: item.resourceId } })} />
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionDark}`}>
          <div className={styles.sectionInner}>
            <h2 className={`${styles.sectionTitle} ${styles.sectionTitleLight}`}>Rooms</h2>
            <div className={styles.grid}>
              {rooms.map((item) => (
                <ReservationProductCard key={item.id} {...item} onSelect={() => router.push({ pathname: "/rooms", query: { resourceId: item.resourceId } })} />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <h2 className={styles.sectionTitle}>Classes</h2>
            <div className={styles.grid}>
              {classes.map((item) => (
                <ResourceCard key={item.id} {...item} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
