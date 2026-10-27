import { businessCalendarDate } from "@/lib/businessTime";
import { useState } from "react";
import { useRouter } from "next/router";
import ResourceCard from "@/components/ResourceCard";
import MonthlyAvailability from "@/components/MonthlyAvailability";
import WeeklyAvailability from "@/components/WeeklyAvailability";
import styles from "@/components/ExplorePage.module.css";
import { buildReservationPeriods, getReservationSlotStartMinutes } from "@/lib/reservationPeriods";
import { calendarMonthPeriod } from "@/lib/monthlyReservation";

const pad = (value) => String(value).padStart(2, "0");

function createInitialSlots(type, startValue, endValue) {
  const start = businessCalendarDate(startValue);
  const end = businessCalendarDate(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];

  const durationMinutes = (end.getTime() - start.getTime()) / (60 * 1000);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 60) return [];
  const roomSlotCount = (durationMinutes + 15) / 75;
  if (type === "rooms" && (!Number.isInteger(roomSlotCount) || roomSlotCount < 1)) return [];
  if (type === "equipment" && durationMinutes % 60 !== 0) return [];
  if (type !== "equipment" && type !== "rooms" && durationMinutes !== 60) return [];
  const startMinute = start.getHours() * 60 + start.getMinutes();
  if (start.getMinutes() % 15 !== 0 || !getReservationSlotStartMinutes(type).includes(startMinute)) return [];

  const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  if (type === "rooms") {
    return Array.from({ length: roomSlotCount }, (_, index) => ({ date, startMinute: startMinute + index * 75 }));
  }
  const slots = Array.from({ length: durationMinutes / 60 }, (_, index) => ({ date, startMinute: startMinute + index * 60 }));
  return type === "equipment" ? slots : slots.slice(0, 1);
}

async function getCsrfToken() {
  const response = await fetch("/api/auth/csrf");
  const result = await response.json();
  if (!response.ok || !result.csrfToken) throw new Error("Could not verify the reservation request. Please try again.");
  return result.csrfToken;
}

export default function ReservationEditor({ type, reservation, resource, resources }) {
  const router = useRouter();
  const [selectedClass, setSelectedClass] = useState(null);
  const [classResources, setClassResources] = useState(resources);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isClass = type === "class";
  const resourceType = type === "room" ? "rooms" : "equipment";

  const finish = async (path = "/reservations") => {
    await router.push({ pathname: path, query: { type: type === "room" ? "rooms" : type === "equipment" ? "equipment" : "classes" } });
  };

  const confirmResourceEdit = async (periods) => {
    setSubmitting(true);
    setError("");
    try {
      const csrfToken = await getCsrfToken();
      const formattedPeriods = reservation.monthly ? periods : periods.map(({ date, startMinute, endDate, endMinute }) => {
        const wallTime = (day, minute) => day + 'T' + pad(Math.floor(minute / 60)) + ':' + pad(minute % 60) + ':00';
        return { start: wallTime(date, startMinute), end: wallTime(endDate, endMinute) };
      });
      const response = await fetch("/api/reservations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          type: resourceType,
          reservationId: reservation.reservationId,
          reservationIds: reservation.reservationIds,
          periods: formattedPeriods,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the reservation.");
      await finish();
    } catch (submitError) {
      setError(submitError.message || "Could not update the reservation.");
      setSubmitting(false);
      throw submitError;
    }
  };

  const refreshClasses = async () => {
    setLoadingClasses(true);
    setError("");
    try {
      const response = await fetch("/api/resources/classes");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load classes.");
      setClassResources(result.classes);
    } catch (loadError) {
      setError(loadError.message || "Could not load classes.");
    } finally {
      setLoadingClasses(false);
    }
  };

  const confirmClassEdit = async () => {
    if (!selectedClass) return;
    setSubmitting(true);
    setError("");
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch("/api/reservations/update-class", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ oldClassId: reservation.classId, newClassId: selectedClass.resourceId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the class reservation.");
      await finish();
    } catch (submitError) {
      setError(submitError.message || "Could not update the class reservation.");
      setSubmitting(false);
    }
  };

  const initialSelectedMonths = reservation.selectedMonths?.length
    ? reservation.selectedMonths
    : reservation.monthly ? [calendarMonthPeriod(reservation.startDate.slice(0, 7), reservation.monthCount || 1).start.slice(0, 7)] : undefined;
  const Availability = reservation.monthly ? MonthlyAvailability : WeeklyAvailability;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Edit Reservation</h1>
        <p className={styles.intro}>Update your {reservation.name} reservation. You can cancel without saving or confirm your changes.</p>
      </header>
      {error && <p role="alert">{error}</p>}
      {isClass ? (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Choose a class</h2>
            <button type="button" onClick={refreshClasses} disabled={loadingClasses}>{loadingClasses ? "Refreshing…" : "Load up-to-date classes"}</button>
            <div className={styles.grid}>
              {classResources.map((item) => (
                <ResourceCard
                  key={item.id}
                  {...item}
                  onSelect={() => setSelectedClass(item)}
                />
              ))}
            </div>
          </section>
          {selectedClass && <p aria-live="polite">Selected: {selectedClass.name} · {selectedClass.time}</p>}
          <div className={styles.section}>
            <button type="button" onClick={() => finish()} disabled={submitting}>Cancel Editing</button>{" "}
            <button type="button" onClick={confirmClassEdit} disabled={!selectedClass || submitting}>
              {submitting ? "Saving…" : "Confirm Changes"}
            </button>
          </div>
        </>
      ) : (
        <Availability
          resource={resource}
          type={resourceType}
          initialDate={reservation.monthly ? (() => { const d = businessCalendarDate(reservation.startDate); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })() : reservation.startDate}
          initialSlots={createInitialSlots(resourceType, reservation.startDate, reservation.endDate)}
          initialMonths={reservation.monthCount || 1}
          initialSelectedMonths={initialSelectedMonths}
          lockMonthCount={reservation.monthly}
          excludedReservationIds={reservation.reservationIds || [reservation.reservationId]}
          unavailableIntervals={resource.unavailableIntervals}
          confirmLabel={submitting ? "Saving…" : "Confirm Changes"}
          cancelLabel="Cancel Editing"
          onClose={() => finish()}
          onConfirm={confirmResourceEdit}
        />
      )}
    </main>
  );
}
