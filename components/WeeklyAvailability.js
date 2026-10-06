"use client";

import { useState } from "react";
import { getWeekAvailability, to12h } from "@/lib/availability";
import styles from "./WeeklyAvailability.module.css";

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return d;
}

function addWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function isCurrentWeek(weekStart) {
  const now = startOfWeek(new Date());
  return weekStart.getTime() === now.getTime();
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function WeeklyAvailability({
  type,
  typeLabel,
  selectable = false,
  selectedSlots = [],
  allowSelectedUnavailable = false,
  initialDate,
  onToggleSlot,
}) {
  const [weekOffset, setWeekOffset] = useState(() => {
    if (!initialDate) return 0;
    const targetWeek = startOfWeek(new Date(`${initialDate}T00:00:00`));
    const currentWeek = startOfWeek(new Date());
    return Math.round((targetWeek.getTime() - currentWeek.getTime()) / (7 * 24 * 60 * 60 * 1000));
  });

  const weekStart = addWeeks(startOfWeek(new Date()), weekOffset);
  const { days } = getWeekAvailability(type, weekStart);
  const currentWeek = isCurrentWeek(weekStart);

  const weekLabel = `${days[0].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const timeSlots = days[0].slots;
  const selectedKeys = new Set(selectedSlots.map((selection) => `${selection.date}:${selection.start}`));

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>Availability — Week of {weekLabel}</h2>
        <div className={styles.weekNav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setWeekOffset((offset) => offset - 1)}
            aria-label="Previous week"
          >
            ←
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setWeekOffset(0)}
            disabled={currentWeek}
          >
            This Week
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setWeekOffset((offset) => offset + 1)}
            aria-label="Next week"
          >
            →
          </button>
        </div>
      </div>

      {selectable && (
        <p className={styles.selectionHint}>
          Click green times to add them. Click highlighted gold times to remove them.
        </p>
      )}

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendAvailable} `} /> Available
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendUnavailable}`} /> Unavailable
        </span>
      </div>

      <div
        className={styles.timetable}
        role="grid"
        aria-label={`${typeLabel} availability for the week of ${weekLabel}`}
      >
        <div className={styles.cornerCell} role="columnheader">Time</div>
        {days.map((day) => (
          <div key={day.name} className={styles.dayHeader} role="columnheader">
            <span className={styles.dayName}>{day.name}</span>
            <span className={styles.dayDate}>
              {day.date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
            </span>
          </div>
        ))}

        {timeSlots.map((timeSlot) => (
          <div key={timeSlot.start} className={styles.gridRow} role="row">
            <div className={styles.timeLabel} role="rowheader">
              {to12h(timeSlot.start)}
            </div>
            {days.map((day) => {
              const slot = day.slots.find((daySlot) => daySlot.start === timeSlot.start);
              const selectionKey = `${formatLocalDate(day.date)}:${slot.start}`;
              const isSelected = selectedKeys.has(selectionKey);
              const isEditableSlot = slot.available || (allowSelectedUnavailable && isSelected);
              const Tag = selectable && isEditableSlot ? "button" : "div";
              return (
                <Tag
                  key={`${day.name}-${slot.start}`}
                  type={Tag === "button" ? "button" : undefined}
                  role="gridcell"
                  className={`${styles.slot} ${slot.available || (allowSelectedUnavailable && isSelected) ? styles.slotAvailable : styles.slotUnavailable} ${isSelected ? styles.slotSelected : ""}`}
                  title={`${day.name}, ${to12h(slot.start)}–${to12h(slot.end)} — ${isSelected ? "Selected for editing" : slot.available ? "Available" : slot.label}`}
                  aria-label={`${day.name} ${to12h(slot.start)}: ${isSelected ? "Selected for editing" : slot.available ? "Available" : slot.label}`}
                  onClick={selectable && isEditableSlot ? () => onToggleSlot?.({
                    date: formatLocalDate(day.date),
                    start: slot.start,
                    end: slot.end,
                  }) : undefined}
                  disabled={selectable && !isEditableSlot ? true : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
