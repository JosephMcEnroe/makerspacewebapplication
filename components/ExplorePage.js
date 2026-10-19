import Head from "next/head";
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuthContext } from "@/context/AuthContext";
import { MEMBERSHIP_REQUIRED_MESSAGE, canReserve } from "@/lib/reservationAccess";
import ResourceCard from "./ReservationProductCard";

import WeeklyAvailability from "./WeeklyAvailability";

import styles from "./ExplorePage.module.css";

export default function ExplorePage({
  title,
  intro,
  bookingWindow,
  resourceType,
  items,
}) {
  const router = useRouter();
  const { user } = useAuthContext();
  const allowedToReserve = canReserve(user);
  const [selectedResource, setSelectedResource] = useState(() => (allowedToReserve && items.find(item => !item.unavailable && String(item.resourceId) === String(router.query.resourceId))) || null);
  const [bookingError, setBookingError] = useState("");
  const available = items.filter((item) => !item.unavailable);
  const unavailable = items.filter((item) => item.unavailable);

  const confirmReservation = async (periods) => {
    if (!user?.id) throw new Error("Please sign in before making a reservation.");
    setBookingError("");

    if (resourceType === "classes") {
      let classCsrfResponse;
      try {
        classCsrfResponse = await fetch("/api/auth/csrf");
      } catch {
        throw new Error("Could not connect to the reservation service. Please try again.");
      }
      const classCsrfData = await classCsrfResponse.json();
      if (!classCsrfResponse.ok || !classCsrfData.csrfToken) {
        throw new Error("Could not verify the reservation request. Please try again.");
      }
      const classMinute = String(selectedResource.scheduledTime || "").match(/:(\d{2})/)?.[1] || "00";
      let classResponse;
      try {
        classResponse = await fetch("/api/reservations/class", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": classCsrfData.csrfToken },
          body: JSON.stringify({
            resourceId: selectedResource.resourceId,
            start: `${periods[0].date}T${String(Math.floor(periods[0].startMinute / 60)).padStart(2, "0")}:${String(periods[0].startMinute % 60).padStart(2, "0")}:00`,
          }),
        });
      } catch {
        throw new Error("Could not connect to the reservation service. Please try again.");
      }
      let classResult;
      try {
        classResult = await classResponse.json();
      } catch {
        throw new Error("The reservation service returned an invalid response.");
      }
      if (!classResponse.ok) throw new Error(classResult.error || "Could not reserve this class.");
      setSelectedResource(null);
      setBookingError("");
      await router.replace({ pathname: "/reservations", query: { type: resourceType, reservationId: [classResult.reservationId] } });
      return;
    }

    let csrfResponse;
    try {
      csrfResponse = await fetch("/api/auth/csrf");
    } catch {
      throw new Error("Could not connect to the reservation service. Please try again.");
    }
    let csrfData;
    try {
      csrfData = await csrfResponse.json();
    } catch {
      throw new Error("Could not verify the reservation request. Please try again.");
    }
    if (!csrfResponse.ok || !csrfData.csrfToken) {
      throw new Error("Could not verify the reservation request. Please try again.");
    }

    const startsAndEnds = periods.map(({ date, startMinute, endDate: endDateKey, endMinute }) => {
      const wallTime = (day, minute) => day + 'T' + String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0') + ':00';
      return { start: wallTime(date, startMinute), end: wallTime(endDateKey, endMinute) };
    });
    let response;
    try {
      response = await fetch("/api/reservations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfData.csrfToken },
        body: JSON.stringify({ type: resourceType, resourceId: selectedResource.resourceId, periods: startsAndEnds }),
      });
    } catch {
      throw new Error("Could not connect to the reservation service. Please try again.");
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The reservation service returned an invalid response.");
    }
    if (!response.ok) throw new Error(result.error || "Could not create the reservation.");

    if (resourceType === "rooms") {
      setSelectedResource(null);
      await router.replace({ pathname: "/reservations", query: { type: resourceType, reservationId: result.reservationIds || [] } });
      return;
    }
    if (!result.url) throw new Error("Checkout did not return a redirect URL.");
    window.location.assign(result.url);
  };

  const Availability = WeeklyAvailability;
  return (
    <div className={styles.page}>
      <Head>
        <title>{title} - The Crafty Studio</title>
        <meta name="description" content={intro} />
      </Head>

      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.intro}>{intro}</p>
        <p className={styles.bookingWindow}>{bookingWindow}</p>
      </header>

      {router.query.canceled && <p role="status">Checkout canceled. No reservation was created.</p>}
      {bookingError && <p role="alert">{bookingError}</p>}
      {user && !allowedToReserve && (
        <p role="status">{MEMBERSHIP_REQUIRED_MESSAGE} <Link href="/membership">View membership options</Link></p>
      )}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Available for Reservation</h2>
        {available.length > 0 ? (
          <>
            <div className={styles.grid}>
              {available.map((item) => (
                <ResourceCard
                  key={item.id ?? item.name}
                  {...item}
                  onSelect={allowedToReserve ? () => {
                    setBookingError("");
                    setSelectedResource(item);
                  } : undefined}
                />
              ))}
            </div>
            <p className={styles.countNote}>
              {available.length} {available.length === 1 ? "option" : "options"} open for booking
            </p>
          </>
        ) : (
          <p className={styles.emptyText}>Nothing available right now — check back soon.</p>
        )}
      </section>

      {unavailable.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Currently Unavailable{" "}
            <span className={styles.sectionHint}>(not currently bookable)</span>
          </h2>
          <div className={styles.grid}>
            {unavailable.map((item) => <ResourceCard key={item.id ?? item.name} {...item} />)}
          </div>
        </section>
      )}

      {selectedResource && (
        <Availability
          confirmLabel={resourceType === "classes" ? "Confirm Reservation" : "Create Reservation"}
          resource={selectedResource}
          type={resourceType}
          initialDate={selectedResource.scheduledDate || undefined}
          unavailableIntervals={selectedResource.unavailableIntervals}
          onClose={() => setSelectedResource(null)}
          onConfirm={confirmReservation}
        />
      )}
    </div>
  );
}
