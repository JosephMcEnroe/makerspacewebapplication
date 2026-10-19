import { machineRepository } from "@/Data_Access_Layer/machineRepository";
import { roomRepository } from "@/Data_Access_Layer/roomRepository";
import { classRepository } from "@/Data_Access_Layer/classRepository";
import { machineBookingRepository } from "@/Data_Access_Layer/machineBookingRepository";
import { roomReservationRepository } from "@/Data_Access_Layer/roomReservationRepository";
import { formatDate, formatTime } from "@/lib/format";
import { getResourceImage } from "@/lib/resourceImages";

function serializableDateTime(value) {
  return value instanceof Date ? value.toISOString() : value == null ? null : String(value);
}

function dateOnly(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

// Server-side loaders that turn equipment / room / class rows into the
// props ResourceCard expects. Used from getServerSideProps.

export async function loadEquipment() {
  const [machines, bookings] = await Promise.all([
    new machineRepository().findAllMachine(),
    new machineBookingRepository().findAllMachineBooking(),
  ]);
  const bookingsByMachine = new Map();
  for (const booking of bookings) {
    const existing = bookingsByMachine.get(String(booking.machine_id)) || [];
    existing.push({
      reservationId: booking.booking_id,
      start: serializableDateTime(booking.start_date_time),
      end: serializableDateTime(booking.end_date_time),
    });
    bookingsByMachine.set(String(booking.machine_id), existing);
  }

  return machines.map((machine) => ({
    id: `machine-${machine.machine_id}`,
    resourceId: String(machine.machine_id),
    unavailableIntervals: bookingsByMachine.get(String(machine.machine_id)) || [],
    image: getResourceImage(`machine-${machine.machine_id}`),
    name: machine.name,
    description: machine.type ?? "",
    // Anything other than "available" (e.g. maintenance, booked) can't be reserved
    unavailable: !!machine.status && machine.status.toLowerCase() !== "available",
  })).sort((a, b) => Number(a.unavailable) - Number(b.unavailable));
}

export async function loadRooms() {
  const [rooms, reservations] = await Promise.all([
    new roomRepository().findAllRoom(),
    new roomReservationRepository().findAllRoomReservation(),
  ]);
  const reservationsByRoom = new Map();
  for (const reservation of reservations) {
    if (reservation.status && reservation.status.toLowerCase().startsWith("cancel")) continue;
    const existing = reservationsByRoom.get(String(reservation.room_id)) || [];
    existing.push({
      reservationId: reservation.reservation_id,
      start: serializableDateTime(reservation.start_date),
      end: serializableDateTime(reservation.end_date),
    });
    reservationsByRoom.set(String(reservation.room_id), existing);
  }

  return rooms.map((room) => ({
    id: `room-${room.room_id}`,
    resourceId: String(room.room_id),
    unavailableIntervals: reservationsByRoom.get(String(room.room_id)) || [],
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
      resourceId: String(cls.class_id),
      scheduledDate: dateOnly(cls.class_date),
      scheduledTime: cls.class_time ? String(cls.class_time) : null,
      image: getResourceImage(`class-${cls.class_id}`),
      name: cls.name_of_class,
      description: cls.description ?? "",
      time: [formatDate(cls.class_date), formatTime(cls.class_time)].filter(Boolean).join(" "),
      spots: cls.max_capacity ? `${cls.max_capacity} spots` : "",
    }));
}
