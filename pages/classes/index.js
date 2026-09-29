import ExplorePage from "@/components/ExplorePage";

// Placeholder until class data is wired up to the database
const CLASSES = [
  {
    name: "Beginner Laser Cutting",
    description:
      "Learn vector design for laser cutting and master the cutter. Create custom projects from coasters to signage.",
    time: "4:15 PM",
    spots: "12/20",
    training: "Laser Safety Training",
  },
  {
    name: "Advanced 3D Printing",
    description:
      "Complete introduction to FDM and resin printing. Covers CAD basics, slicing software, and post-processing techniques.",
    time: "6:30 PM",
    spots: "8/35",
    training: "3D Printer Training",
  },
  {
    name: "Woodworking Workshop",
    description:
      "Master table saw techniques, joinery methods, and finishing. Build a custom furniture piece from start to finish.",
    time: "2:00 PM",
    spots: "15/20",
    training: "Woodshop Safety Training",
  },
  {
    name: "Intro to Ceramics",
    description:
      "Hands-on introduction to wheel throwing and hand building. All materials and firings included.",
    time: "5:00 PM",
    spots: "6/12",
    training: "Ceramics Studio Training",
    unavailable: true,
    unavailableNote: "Fully booked this month — join the waitlist at the front desk.",
  },
];

export default function ClassesPage() {
  return (
    <ExplorePage
      title="Classes"
      intro="Browse upcoming classes and workshops at The Crafty Studio — from first-timer introductions to advanced technique deep dives."
      bookingWindow="Classes can be reserved up to 1 month in advance."
      items={CLASSES}
    />
  );
}
