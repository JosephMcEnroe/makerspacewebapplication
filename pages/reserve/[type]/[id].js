import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { getResource, RESOURCE_TYPES } from "@/lib/resources";
import { addClientReservations, readClientReservations, saveClientReservations } from "@/lib/clientReservations";
import { useAuthContext } from "@/context/AuthContext";
import styles from "../ReserveResource.module.css";

function parseJsonArray(value) {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSelectedSlots(slotsQuery) {
  if (typeof slotsQuery !== "string") return [];
  try {
    const parsed = JSON.parse(slotsQuery);
    return Array.isArray(parsed)
      ? parsed.filter((slot) => {
          const date = slot?.date;
          const start = Number(slot?.start);
          const end = Number(slot?.end);
          return (
            typeof date === "string" &&
            /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) &&
            !Number.isNaN(new Date(`${date}T00:00:00`).getTime()) &&
            Number.isInteger(start) &&
            Number.isInteger(end) &&
            start >= 0 &&
            end <= 1440 &&
            end > start
          );
        })
      : [];
  } catch {
    return [];
  }
}

function formatTime(minutes) {
  const date = new Date(2000, 0, 1, Math.floor(Number(minutes) / 60), Number(minutes) % 60);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function combineAdjacentSlots(slots) {
  return [...slots]
    .sort((a, b) => a.date.localeCompare(b.date) || Number(a.start) - Number(b.start))
    .reduce((combined, slot) => {
      const previous = combined[combined.length - 1];
      const start = Number(slot.start);
      const end = Number(slot.end);

      if (previous && previous.date === slot.date && start <= Number(previous.end)) {
        previous.end = Math.max(Number(previous.end), end);
      } else {
        combined.push({ date: slot.date, start, end });
      }

      return combined;
    }, []);
}

function formatTimeValue(minutes) {
  const totalMinutes = Number(minutes) % 1440;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}:00`;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTimeFromSlot(dateString, minutes) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setMinutes(date.getMinutes() + Number(minutes));
  return `${formatLocalDate(date)}T${formatTimeValue(date.getHours() * 60 + date.getMinutes())}`;
}

function formatTimeFromValue(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return formatTime(hours * 60 + minutes);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReserveResourcePage({ type, resource, notFound }) {
  const router = useRouter();
  const { user } = useAuthContext();

  // Client-side fallback while /reserve/[type]/[id] is still a static shell
  if (router.isFallback) {
    return <div className={styles.page}>Loading…</div>;
  }

  if (notFound || !resource) {
    return (
      <div className={styles.page}>
        <Head>
          <title>Not found - The Crafty Studio</title>
        </Head>
        <h1 className={styles.title}>Resource not found</h1>
        <p className={styles.intro}>
          The {type ? RESOURCE_TYPES[type]?.label.toLowerCase() || type : "resource"} you
          are looking for doesn&apos;t exist.
        </p>
        <Link href={type ? `/${type}` : "/dashboard"} className={styles.backLink}>
          ← Back to browsing
        </Link>
      </div>
    );
  }

  const typeConfig = RESOURCE_TYPES[type];
  const unavailable = Boolean(resource.unavailable);
  const selectedSlots = combineAdjacentSlots(parseSelectedSlots(router.query.slots));
  const editIds = parseJsonArray(router.query.editIds);

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const details = Object.fromEntries(formData.entries());
    if (selectedSlots.length === 0) {
      window.alert("Select at least one available time from the timetable before reserving.");
      return;
    }

    const startsAndEnds = selectedSlots.map((slot) => ({
      start: dateTimeFromSlot(slot.date, slot.start),
      end: dateTimeFromSlot(slot.date, slot.end),
    }));

    try {
      const now = new Date().toISOString();
      const existing = editIds.length > 0 ? readClientReservations(user?.id) : [];
      const editedRecords = startsAndEnds.map((period, index) => ({
        id: index === 0 ? editIds[0] : `reservation-${Date.now()}-${index}`,
        type,
        resourceId: resource.id,
        name: resource.name,
        start: period.start,
        end: period.end,
        time: `${formatDate(period.start.slice(0, 10))} · ${formatTimeFromValue(period.start.slice(11))}–${formatTimeFromValue(period.end.slice(11))}`,
        status: "upcoming",
        notes: details.notes || "",
        createdAt: now,
      }));

      if (editIds.length > 0) {
        const updated = [
          ...existing.filter((entry) => !editIds.includes(entry.id)),
          ...editedRecords,
        ];
        if (!saveClientReservations(user?.id, updated)) {
          throw new Error("Could not save the updated reservation in this browser.");
        }
      } else {
        addClientReservations(user?.id, editedRecords);
      }
      router.push("/reservations");
    } catch (error) {
      window.alert(error.message || "Could not save the reservation. Please try again.");
    }
  };

  return (
    <div className={styles.page}>
      <Head>
        <title>Reserve {resource.name} - The Crafty Studio</title>
        <meta name="description" content={resource.description} />
      </Head>

      <Link href={`/${type}`} className={styles.backLink}>
        ← Back to {typeConfig.plural.toLowerCase()}
      </Link>

      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.typeLabel}>{typeConfig.label} Reservation</p>
          <h1 className={styles.title}>{resource.name}</h1>
          <p className={styles.description}>{resource.description}</p>
          {(resource.time || resource.spots) && (
            <p className={styles.meta}>
              {resource.time && <span>{resource.time}</span>}
              {resource.time && resource.spots && <span className={styles.metaDot}>•</span>}
              {resource.spots && <span>{resource.spots} spots filled</span>}
            </p>
          )}
        </div>
        <div className={styles.imagePlaceholder} aria-hidden="true">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
      </header>

      {unavailable ? (
        <div className={styles.unavailablePanel}>
          <h2 className={styles.unavailableTitle}>Currently Unavailable</h2>
          <p className={styles.unavailableText}>
            {resource.unavailableNote ||
              "This resource is booked for the month and cannot be reserved right now."}
          </p>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <h2 className={styles.formTitle}>{editIds.length > 0 ? "Edit" : "Confirm"} {typeConfig.label.toLowerCase()} reservation</h2>
          <p className={styles.bookingWindow}>
            Can be reserved up to {typeConfig.maxAdvanceLabel} in advance.
          </p>

          {selectedSlots.length > 0 ? (
            <div className={styles.selectedRoomSlots}>
              <p className={styles.label}>Reservation periods ({selectedSlots.length})</p>
              <ul>
                {selectedSlots.map((slot) => (
                  <li key={`${slot.date}-${slot.start}`}>
                    {formatDate(slot.date)} · {formatTime(slot.start)}–{formatTime(slot.end)}
                  </li>
                ))}
              </ul>
              <input
                type="hidden"
                name="selectedSlots"
                value={JSON.stringify(selectedSlots)}
                readOnly
              />
            </div>
          ) : (
            <p className={styles.hint} role="alert">
              No times were selected. Go back to {typeConfig.plural.toLowerCase()} and select one or more available times from the timetable.
            </p>
          )}

          {type === "classes" && (
            <p className={styles.classNote}>
              Reserve your spot in this scheduled class. Your booking will be added to your reservations immediately.
            </p>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="notes">
              Notes for the studio (optional)
            </label>
            <textarea
              className={styles.textarea}
              id="notes"
              name="notes"
              rows={3}
              placeholder="Anything the staff should know before your reservation"
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={selectedSlots.length === 0}>
            {editIds.length > 0 ? "Save Changes" : "Reserve Now"}
          </button>
        </form>
      )}
    </div>
  );
}

export async function getStaticPaths() {
  // Only pre-render at request time; ids resolve on demand
  return { paths: [], fallback: true };
}

export async function getStaticProps({ params }) {
  const { type, id } = params || {};
  const resource = getResource(type, Array.isArray(id) ? id[0] : id);

  if (!resource) {
    return { props: { type, resource: null, notFound: true } };
  }

  return { props: { type, resource } };
}
