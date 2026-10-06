import ExplorePage from "@/components/ExplorePage";
import { CLASSES } from "@/lib/resources";

export default function ClassesPage() {
  return (
    <ExplorePage
      type="classes"
      title="Classes"
      intro="Browse upcoming classes and workshops at The Crafty Studio — from first-timer introductions to advanced technique deep dives. Click any class to reserve a spot."
      bookingWindow="Classes can be reserved up to 1 month in advance."
      items={CLASSES}
    />
  );
}
