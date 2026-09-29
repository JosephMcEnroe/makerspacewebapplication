import ExplorePage from "@/components/ExplorePage";

// Placeholder until room data is wired up to the database
const ROOMS = [
  {
    name: "Main Studio",
    description:
      "Spacious open workspace with natural lighting, perfect for larger projects and collaborative work. Features multiple workstations and ample storage.",
  },
  {
    name: "Podcast Recording Room",
    description:
      "Soundproofed room with professional microphone and audio interface. Remote recording capabilities available.",
  },
  {
    name: "Woodshop",
    description:
      "Fully stocked woodshop with table saws, band saws, and hand tools. Dust collection and safety equipment provided.",
  },
  {
    name: "Ceramics Studio",
    description:
      "Dedicated ceramics space with pottery wheels, kilns, and glazing stations. Clay storage available for members.",
    unavailable: true,
    unavailableNote: "Booked for the month — check back when a slot opens up.",
  },
];

export default function RoomsPage() {
  return (
    <ExplorePage
      title="Rooms"
      intro="Explore the rooms available at The Crafty Studio, from open studios to specialized workshop spaces."
      bookingWindow="Rooms can be reserved up to 3 months in advance."
      items={ROOMS}
    />
  );
}
