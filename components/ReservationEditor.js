import { useState } from "react";
import { useRouter } from "next/router";
import ResourceCard from "@/components/ResourceCard";
import WeeklyAvailability from "@/components/WeeklyAvailability";
import styles from "@/components/ExplorePage.module.css";
import { getReservationSlotStartMinutes } from "@/lib/reservationPeriods";

const pad = (value) => String(value).padStart(2, "0");

function createInitialSlots(type, startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];

  if (end.getTime() - start.getTime() !== 60 * 60 * 1000) return [];
  const startMinute = start.getHours() * 60 + start.getMinutes();
  if (start.getMinutes() % 15 !== 0 || !getReservationSlotStartMinutes(type).includes(startMinute)) return [];

  return [{
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    startMinute,
  }];
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
      const formattedPeriods = periods.map(({ date, startMinute, endDate, endMinute }) => {
        const startDate = new Date(`${date}T00:00:00`);
        startDate.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
        const finishDate = new Date(`${endDate}T00:00:00`);
        finishDate.setHours(Math.floor(endMinute / 60), endMinute % 60, 0, 0);
        const localDateTime = (value) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:00`;
        return { start: localDateTime(startDate), end: localDateTime(finishDate) };
      });
      const response = await fetch("/api/reservations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ type: resourceType, reservationId: reservation.reservationId, periods: formattedPeriods }),
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
        <WeeklyAvailability
          resource={resource}
          type={resourceType}
          initialDate={reservation.startDate}
          initialSlots={createInitialSlots(resourceType, reservation.startDate, reservation.endDate)}
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
