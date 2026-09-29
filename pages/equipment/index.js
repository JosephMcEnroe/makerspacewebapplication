import ExplorePage from "@/components/ExplorePage";

// Placeholder until equipment data is wired up to the database
const EQUIPMENT = [
  {
    name: "Laser Cutter Pro",
    description:
      "High-precision laser cutting for wood, acrylic, and metal. Supports vector engraving and intricate pattern work.",
  },
  {
    name: "Table Saw Station",
    description:
      "Professional-grade table saw with digital fence system. Perfect for precise straight cuts and joinery work.",
  },
  {
    name: "3D Printer",
    description:
      "Ultra-detailed printing with 0.05mm layer resolution. Ideal for miniatures, jewelry, and prototypes.",
  },
  {
    name: "Vinyl Cutter",
    description:
      "Large-format vinyl cutting for decals, signs, and heat transfers. Includes weeding tools and application tape.",
  },
  {
    name: "CNC Router",
    description:
      "Computer-controlled router for carving wood, plastics, and soft metals. Great for signs, molds, and furniture parts.",
    unavailable: true,
    unavailableNote: "Booked for the month — reservations reopen next month.",
  },
];

export default function EquipmentPage() {
  return (
    <ExplorePage
      title="Equipment"
      intro="Explore the equipment available at The Crafty Studio, from precision cutters to printing and fabrication tools."
      bookingWindow="Equipment can be reserved up to 1 month in advance."
      items={EQUIPMENT}
    />
  );
}
