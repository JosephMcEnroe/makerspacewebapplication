import ExplorePage from "@/components/ExplorePage";
import { loadClasses } from "@/lib/resources";

export async function getServerSideProps() {
  return { props: { classes: await loadClasses() } };
}

export default function ClassesPage({ classes }) {
  return (
    <ExplorePage
      title="Classes"
      intro="Browse upcoming classes and workshops at The Crafty Studio — from first-timer introductions to advanced technique deep dives."
      bookingWindow="Classes can be reserved up to 1 month in advance."
      items={classes}
    />
  );
}
