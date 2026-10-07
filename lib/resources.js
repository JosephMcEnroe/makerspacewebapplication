// Placeholder data until rooms / classes / equipment are wired up to the database.
// Each resource needs a stable `id` so its reservation page can be linked.
export const ROOMS = [
  {
    id: "main-studio",
    name: "Main Studio",
    description:
      "Spacious open workspace with natural lighting. Features multiple workstations and plenty of storage for members.",
    training: "Studio Orientation",
  },
  {
    id: "podcast-recording-room",
    name: "Podcast Recording Room",
    description:
      "Soundproofed room with professional microphone and audio interface. Remote recording capabilities available.",
    training: "Audio Equipment Training",
  },
  {
    id: "woodshop",
    name: "Woodshop",
    description:
      "Fully stocked woodshop with table saws, band saws, and hand tools. Dust collection and safety equipment provided.",
    training: "Woodshop Safety Training",
  },
  {
    id: "ceramics-studio",
    name: "Ceramics Studio",
    description:
      "Dedicated ceramics space with pottery wheels, kilns, and glazing stations. Clay storage available for members.",
    training: "Ceramics Studio Training",
    unavailable: true,
    unavailableNote: "Booked for the month — check back when a slot opens up.",
  },
];

export const CLASSES = [
  {
    id: "beginner-laser-cutting",
    name: "Beginner Laser Cutting",
    description:
      "Learn vector design for laser cutting and master the cutter. Create custom projects from coasters to signage.",
    time: "4:15 PM",
    spots: "12/20",
    training: "Laser Safety Training",
  },
  {
    id: "advanced-3d-printing",
    name: "Advanced 3D Printing",
    description:
      "Complete introduction to FDM and resin printing. Covers CAD basics, slicing software, and post-processing techniques.",
    time: "6:30 PM",
    spots: "8/35",
    training: "3D Printer Training",
  },
  {
    id: "woodworking-workshop",
    name: "Woodworking Workshop",
    description:
      "Master table saw techniques, joinery methods, and finishing. Build a custom furniture piece from start to finish.",
    time: "2:00 PM",
    spots: "15/20",
    training: "Woodshop Safety Training",
  },
  {
    id: "intro-to-ceramics",
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

export const EQUIPMENT = [
  {
    id: "laser-cutter-pro",
    name: "Laser Cutter Pro",
    description:
      "High-precision laser cutting for wood, acrylic, and metal. Supports vector engraving and intricate pattern work.",
    training: "Laser Safety Training",
  },
  {
    id: "table-saw-station",
    name: "Table Saw Station",
    description:
      "Professional-grade table saw with digital fence system. Perfect for precise straight cuts and joinery work.",
    training: "Woodshop Safety Training",
  },
  {
    id: "3d-printer",
    name: "3D Printer",
    description:
      "Ultra-detailed printing with 0.05mm layer resolution. Ideal for miniatures, jewelry, and prototypes.",
    training: "3D Printer Training",
  },
  {
    id: "vinyl-cutter",
    name: "Vinyl Cutter",
    description:
      "Large-format vinyl cutting for decals, signs, and heat transfers. Includes weeding tools and application tape.",
    training: "Vinyl Cutter Training",
  },
  {
    id: "cnc-router",
    name: "CNC Router",
    description:
      "Computer-controlled router for carving wood, plastics, and soft metals. Great for signs, molds, and furniture parts.",
    training: "Woodshop Safety Training",
    unavailable: true,
    unavailableNote: "Booked for the month — reservations reopen next month.",
  },
];

export const RESOURCE_TYPES = {
  rooms: {
    label: "Room",
    plural: "Rooms",
    items: ROOMS,
    maxAdvanceMonths: 3,
    maxAdvanceLabel: "3 months",
  },
  classes: {
    label: "Class",
    plural: "Classes",
    items: CLASSES,
    maxAdvanceMonths: 1,
    maxAdvanceLabel: "1 month",
  },
  equipment: {
    label: "Equipment",
    plural: "Equipment",
    items: EQUIPMENT,
    maxAdvanceMonths: 1,
    maxAdvanceLabel: "1 month",
  },
};

export function getResource(type, id) {
  const typeConfig = RESOURCE_TYPES[type];
  if (!typeConfig) return null;
  return typeConfig.items.find((item) => item.id === id) || null;
}
