import { RESERVATION_BUFFER_MINUTES } from "./reservationPeriods";
import { businessTime } from "./businessTime";

const normalizeStatus = (status) => String(status || "").toLowerCase().startsWith("cancel") ? "cancelled" : "active";
const reservationMinutes = (start, end) => (businessTime(end) - businessTime(start)) / 60000;
const canJoinReservationGroup = (group, reservation) => {
  const previous = group?.reservations.at(-1);
  if (!previous) return false;
  return reservationMinutes(previous.start_date, previous.end_date) === 60
    && reservationMinutes(reservation.start_date, reservation.end_date) === 60
    && String(group.roomId) === String(reservation.room_id)
    && String(group.userId) === String(reservation.user_id)
    && group.status === normalizeStatus(reservation.status)
    && (businessTime(reservation.start_date) - businessTime(previous.end_date)) / 60000 === RESERVATION_BUFFER_MINUTES;
};

export function canJoinRoomReservationGroup(group, reservation) {
  return canJoinReservationGroup(group, reservation);
}

export function groupRoomReservations(rows) {
  const sorted = [...rows].sort((a, b) => businessTime(a.start_date) - businessTime(b.start_date));
  const grouped = [];

  for (const reservation of sorted) {
    const previous = grouped.at(-1);
    if (canJoinReservationGroup(previous, reservation)) previous.reservations.push(reservation);
    else grouped.push({
      roomId: reservation.room_id,
      userId: reservation.user_id,
      status: normalizeStatus(reservation.status),
      reservations: [reservation],
    });
  }

  return grouped.map(({ reservations }) => {
    const first = reservations[0];
    const last = reservations.at(-1);
    return {
      ...first,
      reservation_ids: reservations.map((reservation) => reservation.reservation_id),
      start_date: first.start_date,
      end_date: last.end_date,
    };
  });
}

export function mergeRoomReservationPeriods(periods, { userId = 1, roomId = 1 } = {}) {
  const rows = periods.map((period, index) => ({
    reservation_id: index + 1,
    user_id: userId,
    room_id: roomId,
    start_date: period.start,
    end_date: period.end,
    status: "upcoming",
  }));
  return groupRoomReservations(rows).map(({ start_date, end_date }) => ({ start: start_date, end: end_date }));
}
