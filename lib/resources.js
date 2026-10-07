import { machineRepository } from "@/Data_Access_Layer/machineRepository";
import { roomRepository } from "@/Data_Access_Layer/roomRepository";
import { classRepository } from "@/Data_Access_Layer/classRepository";
import { formatDate, formatTime } from "@/lib/format";
import { getResourceImage } from "@/lib/resourceImages";

// Server-side loaders that turn equipment / room / class rows into the
// props ResourceCard expects. Used from getServerSideProps.

export async function loadEquipment() {
  const machines = await new machineRepository().findAllMachine();

  return machines.map((machine) => ({
    id: `machine-${machine.machine_id}`,
    image: getResourceImage(`machine-${machine.machine_id}`),
    name: machine.name,
    description: machine.type ?? "",
    // Anything other than "available" (e.g. maintenance, booked) can't be reserved
    unavailable: !!machine.status && machine.status.toLowerCase() !== "available",
  })).sort((a, b) => Number(a.unavailable) - Number(b.unavailable));
}

export async function loadRooms() {
  const rooms = await new roomRepository().findAllRoom();

  return rooms.map((room) => ({
    id: `room-${room.room_id}`,
    image: getResourceImage(`room-${room.room_id}`),
    name: room.name,
    description: room.type ?? "",
  }));
}

// Only classes from today onward
export async function loadClasses() {
  const classes = await new classRepository().findAllClass();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return classes
    .filter((cls) => !cls.class_date || new Date(cls.class_date) >= today)
    .map((cls) => ({
      id: `class-${cls.class_id}`,
      image: getResourceImage(`class-${cls.class_id}`),
      name: cls.name_of_class,
      description: cls.description ?? "",
      time: [formatDate(cls.class_date), formatTime(cls.class_time)].filter(Boolean).join(" "),
      spots: cls.max_capacity ? `${cls.max_capacity} spots` : "",
    }));
}
