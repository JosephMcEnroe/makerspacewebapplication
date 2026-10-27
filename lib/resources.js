import { businessDateTime } from "@/lib/businessTime";
import { loadStripeProducts, matchResourceProduct } from "@/lib/stripeCatalog";
import { machineRepository } from "@/Data_Access_Layer/machineRepository";
import { roomRepository } from "@/Data_Access_Layer/roomRepository";
import { classRepository } from "@/Data_Access_Layer/classRepository";
import { machineBookingRepository } from "@/Data_Access_Layer/machineBookingRepository";
import { roomReservationRepository } from "@/Data_Access_Layer/roomReservationRepository";
import { formatDate, formatTime } from "@/lib/format";
import { getResourceImage } from "@/lib/resourceImages";
import { groupResources } from "@/lib/resourceGroups";

function serializableDateTime(value) {
  return value instanceof Date ? value.toISOString() : value == null ? null : String(value);
}

function dateOnly(value) {
  if (!value) return null;
  return value instanceof Date ? businessDateTime(value).slice(0, 10) : String(value).slice(0, 10);
}

// Server-side loaders that turn equipment / room / class rows into the
// props ResourceCard expects. Used from getServerSideProps.

function stripeResources(resources, products, type) {
  const field = type === "rooms" ? "room_id" : "equipment_id";
  return resources.filter(resource => products.some(p => resource.stripeKey && p.metadata?.[field] === resource.stripeKey))
    .map(resource => {
      try {
        const product = matchResourceProduct(products, type, resource.stripeKey);
        return { ...resource, name: product.name, description: product.description || "",
          image: product.image || resource.image, product: { ...product, image: product.image || resource.image } };
      } catch (error) {
        console.error(`Stripe resource configuration (${resource.stripeKey}):`, error.message);
        const matches = products.filter(p => p.metadata?.[field] === resource.stripeKey);
        const product = matches.length === 1 ? matches[0] : null;
        return { ...resource, unavailable: true, unavailableNote: "Pricing is currently unavailable.",
          ...(product && { name: product.name, description: product.description || "",
            product: { ...product, image: product.image || resource.image } }) };
      }
    });
}

export async function loadEquipment({ stripe = true } = {}) {
  const [machines, bookings, products] = await Promise.all([
    new machineRepository().findAllMachine(),
    new machineBookingRepository().findAllMachineBooking(),
    stripe ? loadStripeProducts() : [],
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

  const resources = machines.map((machine) => ({
    stripeKey: machine.stripe_machine_id || null,
    id: `machine-${machine.machine_id}`,
    resourceId: String(machine.machine_id),
    unavailableIntervals: bookingsByMachine.get(String(machine.machine_id)) || [],
    image: getResourceImage(`machine-${machine.machine_id}`),
    name: machine.name,
    instanceName: machine.name,
    description: machine.type ?? "",
    // Anything other than "available" (e.g. maintenance, booked) can't be reserved
    unavailable: !!machine.status && machine.status.toLowerCase() !== "available",
  })).sort((a, b) => Number(a.unavailable) - Number(b.unavailable));
  const catalog = stripe ? stripeResources(resources, products, "equipment") : resources;
  return groupResources(catalog);
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

  const resources = rooms.map((room) => ({
    stripeKey: room.stripe_room_id || null,
    id: `room-${room.room_id}`,
    resourceId: String(room.room_id),
    unavailableIntervals: reservationsByRoom.get(String(room.room_id)) || [],
    image: getResourceImage(`room-${room.room_id}`),
    name: room.name,
    instanceName: room.name,
    description: room.type ?? "",
  }));
  return groupResources(resources);
}

// Only classes from today onward
export async function loadClasses() {
  const classes = await new classRepository().findAllClass();
  const today = businessDateTime().slice(0, 10);

  return classes
    .filter((cls) => !cls.class_date || dateOnly(cls.class_date) >= today)
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
