// Training modules members complete before using equipment. Keys match
// machine.stripe_machine_id (see RESERVATION_CHECKOUT.md).
//
// Each module can show a video, reading sections, or both:
//   - videoUrl: an .mp4 path (e.g. "/videos/laser.mp4" in /public) or a
//     YouTube embed URL ("https://www.youtube.com/embed/<id>")
//   - sections: headed lists of safety points shown as reading material
//
// Placeholder wording - replace with the studio's actual training material.

const GENERAL_SAFETY = {
  heading: "General shop safety",
  points: [
    "Wear safety glasses at all times while the machine is running. Tie back long hair and remove loose jewelry.",
    "Never leave a running machine unattended.",
    "Report any damage, strange noises, or malfunctions to staff immediately and stop using the machine.",
    "Clean the machine and work area when you are finished.",
  ],
};

export const TRAINING_MODULES = [
  {
    key: "3d_printer",
    name: "3D Printer",
    model: "Ultimaker S3 & Formlabs Form 3",
    duration: "15 min",
    videoUrl: null,
    sections: [
      {
        heading: "Before you print",
        points: [
          "Slice your model with the studio profile for the printer you reserved.",
          "Check the build plate is clean and level, and that there is enough filament or resin.",
          "Resin printing: wear nitrile gloves when handling resin and uncured parts.",
        ],
      },
      {
        heading: "During and after the print",
        points: [
          "Watch the first layer go down; cancel the print if it is not sticking.",
          "Do not touch the nozzle or heated bed. They reach over 200°C.",
          "Let the bed cool before removing parts, and wash/cure resin parts in the post-processing station.",
        ],
      },
      GENERAL_SAFETY,
    ],
  },
  {
    key: "laser",
    name: "Laser Cutter",
    model: "Epilog Fusion Pro 36",
    duration: "20 min",
    videoUrl: null,
    sections: [
      {
        heading: "Approved materials",
        points: [
          "Only cut materials on the posted approved list (wood, acrylic, paper, leather).",
          "Never cut PVC, vinyl, or anything containing chlorine. It releases toxic gas and damages the machine.",
        ],
      },
      {
        heading: "Running a job",
        points: [
          "Turn on the exhaust/air assist before starting every job.",
          "Stay with the laser for the entire job. Small flare-ups are normal; a sustained flame is not.",
          "If a fire starts, open nothing. Press stop, and use the fire blanket or extinguisher next to the machine, then notify staff.",
          "Wait for smoke to clear before opening the lid.",
        ],
      },
      GENERAL_SAFETY,
    ],
  },
  {
    key: "small_cnc",
    name: "CNC Router (Small)",
    model: "ShopBot Desktop MAX",
    duration: "25 min",
    videoUrl: null,
    sections: [
      {
        heading: "Setup",
        points: [
          "Clamp or screw your stock down securely and keep clamps out of the toolpath.",
          "Confirm the correct bit is installed and tightened, and zero X, Y, and Z before cutting.",
          "Run an air cut (spindle off, raised Z) if you are unsure about your toolpath.",
        ],
      },
      {
        heading: "Cutting",
        points: [
          "Wear hearing and eye protection. Keep hands out of the machine while the spindle is moving.",
          "Know where the emergency stop is and use it if anything looks wrong.",
          "Run dust collection for every cut.",
        ],
      },
      GENERAL_SAFETY,
    ],
  },
  {
    key: "large_cnc",
    name: "CNC Router (Large)",
    model: "ShopBot PRSalpha",
    duration: "30 min",
    videoUrl: null,
    sections: [
      {
        heading: "Setup",
        points: [
          "Use the spoilboard and screw down sheet goods. Never cut directly into the table.",
          "Confirm the correct bit is installed and tightened, and zero X, Y, and Z before cutting.",
          "Clear the gantry path of tools, clamps, and offcuts.",
        ],
      },
      {
        heading: "Cutting",
        points: [
          "Wear hearing and eye protection and stay outside the gantry path while it moves.",
          "Know where the emergency stop is and use it if anything looks wrong.",
          "Run dust collection for every cut.",
        ],
      },
      GENERAL_SAFETY,
    ],
  },
  {
    key: "wood_lathe",
    name: "Wood Lathe",
    model: "Powermatic 3520C",
    duration: "20 min",
    videoUrl: null,
    sections: [
      {
        heading: "Before turning",
        points: [
          "Wear a face shield, not just safety glasses. No gloves, loose sleeves, or dangling cords.",
          "Inspect your blank for cracks, knots, and loose bark, and mount it securely.",
          "Rotate the work by hand to confirm it clears the tool rest before switching on.",
          "Start at the lowest speed and increase gradually.",
        ],
      },
      {
        heading: "While turning",
        points: [
          "Keep the tool on the rest before it touches the work, and keep the rest close to the work.",
          "Stand out of the line of fire when starting the lathe.",
          "Turn the lathe off before adjusting the tool rest.",
        ],
      },
      GENERAL_SAFETY,
    ],
  },
  {
    key: "metal_lathe",
    name: "Metal Lathe",
    model: "Grizzly G0602",
    duration: "25 min",
    videoUrl: null,
    sections: [
      {
        heading: "Before cutting",
        points: [
          "Remove the chuck key immediately after use. Never leave it in the chuck.",
          "No gloves near rotating work. Wear safety glasses and roll up sleeves.",
          "Check the work is tight in the chuck and the tool is on center.",
        ],
      },
      {
        heading: "While cutting",
        points: [
          "Use a brush or hook to clear chips. Never your hands.",
          "Keep the carriage clear of the chuck and know where the stop switch is.",
        ],
      },
      GENERAL_SAFETY,
    ],
  },
];

const MODULES_BY_KEY = Object.fromEntries(TRAINING_MODULES.map((module) => [module.key, module]));

export function getTrainingModule(key) {
  return MODULES_BY_KEY[key] || null;
}

// YouTube/Vimeo links embed in an iframe; anything else plays in <video>
export function isEmbedVideo(url) {
  return /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)\//.test(url || "");
}
