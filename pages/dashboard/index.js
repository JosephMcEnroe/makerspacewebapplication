import Head from "next/head";
import Navbar from "@/components/Navbar";
import ResourceCard from "@/components/ResourceCard";
import styles from "@/styles/Dashboard.module.css";

// Placeholder until equipment/room/class data is wired up to the database
const EQUIPMENT = [
  {
    name: "Laser Cutter Pro",
    description: "High-precision laser cutting for wood, acrylic, and metal. Supports vector engraving and intricate pattern work.",
  },
  {
    name: "Table Saw Station",
    description: "Professional-grade table saw with digital fence system. Perfect for precise straight cuts and joinery work.",
  },
  {
    name: "3D Printer",
    description: "Ultra-detailed printing with 0.05mm layer resolution. Ideal for miniatures, jewelry, and prototypes.",
  },
];

const ROOMS = [
  {
    name: "Main Studio",
    description: "Spacious open workspace with natural lighting, perfect for larger projects and collaborative work. Features multiple workstations and ample storage.",
  },
  {
    name: "Podcast Recording Room",
    description: "Soundproofed room with professional microphone and audio interface. Remote recording capabilities available.",
  },
  {
    name: "Gallery Space",
    description: "Exhibition area for showcasing finished work. Perfect for hosting events, critiques, and sharing your creations with the community.",
  },
];

const CLASSES = [
  {
    name: "Beginner Laser Cutting",
    description: "Learn vector design for laser cutting and master the cutter. Create custom projects from coasters to signage.",
    time: "4:15 PM",
    spots: "12/20",
  },
  {
    name: "Advanced 3D Printing",
    description: "Complete introduction to FDM and resin printing. Covers CAD basics, slicing software, and post-processing techniques.",
    time: "6:30 PM",
    spots: "8/35",
  },
  {
    name: "Woodworking Workshop",
    description: "Master table saw techniques, joinery methods, and finishing. Build a custom furniture piece from start to finish.",
    time: "2:00 PM",
    spots: "15/20",
  },
];

export default function DashboardPage() {
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
              {EQUIPMENT.map((item) => (
                <ResourceCard key={item.name} {...item} />
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionDark}`}>
          <div className={styles.sectionInner}>
            <h2 className={`${styles.sectionTitle} ${styles.sectionTitleLight}`}>Rooms</h2>
            <div className={styles.grid}>
              {ROOMS.map((item) => (
                <ResourceCard key={item.name} {...item} />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <h2 className={styles.sectionTitle}>Classes</h2>
            <div className={styles.grid}>
              {CLASSES.map((item) => (
                <ResourceCard key={item.name} {...item} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
