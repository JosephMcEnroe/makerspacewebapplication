import ExplorePage from "@/components/ExplorePage";
import { EQUIPMENT } from "@/lib/resources";

export default function EquipmentPage() {
  return (
    <ExplorePage
      type="equipment"
      title="Equipment"
      intro="Explore the equipment available at The Crafty Studio, from precision cutters to printing and fabrication tools. Click any machine to reserve it."
      bookingWindow="Equipment can be reserved up to 1 month in advance."
      items={EQUIPMENT}
    />
  );
}
