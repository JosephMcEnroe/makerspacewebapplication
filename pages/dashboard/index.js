import { useRouter } from "next/router";
import ReservationProductCard from "@/components/ReservationProductCard";
import Head from "next/head";
// import Link from "next/link"; // used by the disabled hero banner below
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
        {/* Hero banner - disabled until we have a photo. To enable: add the image at
            public/images/hero.jpg, uncomment this and the Link import, and change the
            Equipment <h1> below to <h2> (the hero title becomes the page's <h1>).
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <h1 className={styles.heroTitle}>Make Something Great</h1>
            <p className={styles.heroText}>
              Reserve tools, book a studio, or learn a new skill at The Crafty Studio.
            </p>
            <div className={styles.heroActions}>
              <Link href="/equipment" className={styles.heroPrimary}>Reserve Equipment</Link>
              <Link href="/classes" className={styles.heroSecondary}>Browse Classes</Link>
            </div>
          </div>
        </section>
        */}

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
                <ResourceCard key={item.id} {...item} onSelect={() => router.push({ pathname: "/classes", query: { resourceId: item.resourceId } })} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
