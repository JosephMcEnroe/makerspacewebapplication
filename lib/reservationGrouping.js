import { RESERVATION_BUFFER_MINUTES } from "./reservationPeriods";
import { businessDateTime, businessTime } from "./businessTime";
import { calendarMonthPeriod, getMonthlyReservationCount } from "./monthlyReservation";

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
  const paidMonthlyGroups = new Map();
  const ungrouped = [];
  for (const reservation of sorted) {
    const monthCount = getMonthlyReservationCount(reservation.start_date, reservation.end_date);
    if (reservation.stripe_checkout_session_id && monthCount !== null) {
      const key = `${reservation.stripe_checkout_session_id}:${reservation.room_id}:${reservation.user_id}:${normalizeStatus(reservation.status)}`;
      if (!paidMonthlyGroups.has(key)) paidMonthlyGroups.set(key, []);
      paidMonthlyGroups.get(key).push(reservation);
    } else {
      ungrouped.push(reservation);
    }
  }
  const grouped = [];

  for (const reservation of ungrouped) {
    const previous = grouped.at(-1);
    if (canJoinReservationGroup(previous, reservation)) previous.reservations.push(reservation);
    else grouped.push({
      roomId: reservation.room_id,
      userId: reservation.user_id,
      status: normalizeStatus(reservation.status),
      reservations: [reservation],
    });
  }

  const hourlyGroups = grouped.map(({ reservations }) => {
    const first = reservations[0];
    const last = reservations.at(-1);
    return {
      ...first,
      reservation_ids: reservations.map((reservation) => reservation.reservation_id),
      start_date: first.start_date,
      end_date: last.end_date,
    };
  });
  const monthlyGroups = [...paidMonthlyGroups.values()].map((reservations) => {
    const ordered = reservations.sort((a, b) => businessTime(a.start_date) - businessTime(b.start_date));
    const first = ordered[0];
    const months = ordered.flatMap((reservation) => {
      const count = getMonthlyReservationCount(reservation.start_date, reservation.end_date);
      const [year, month] = businessDateTime(reservation.start_date).slice(0, 7).split("-").map(Number);
      return Array.from({ length: count }, (_, index) => {
        const date = new Date(Date.UTC(year, month - 1 + index, 1));
        return { month: date.toISOString().slice(0, 7), start: calendarMonthPeriod(date.toISOString().slice(0, 7), 1).start };
      });
    });
    return {
      ...first,
      reservation_ids: ordered.map((reservation) => reservation.reservation_id),
      start_date: first.start_date,
      end_date: ordered.at(-1).end_date,
      monthly_months: [...new Map(months.map(({ month, start }) => [month, { month, start }])).values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(({ month }) => calendarMonthPeriod(month, 1)),
    };
  });
  return [...hourlyGroups, ...monthlyGroups].sort((a, b) => businessTime(a.start_date) - businessTime(b.start_date));
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
