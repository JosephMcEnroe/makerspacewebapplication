import { describe, expect, it } from "vitest";
import { buildInstructorClasses, CLASS_DURATION_MINUTES, toInstructorClass } from "./instructorClasses";

// Classes run in Eastern wall-clock time; the DB hands back a Date parsed by
// lib/db.js, so 13:00 UTC on Nov 14 2026 is 8:00 AM for the studio.
const snowDay = {
  class_id: 1,
  name_of_class: "Izzy's PC Class",
  description: "Learn to use Izzy's PC",
  class_date: new Date("2026-11-14T13:00:00Z"),
  max_capacity: 30,
  enrolled: 1,
};

describe("instructor dashboard classes", () => {
  it("formats a class with its one-hour slot in business time", () => {
    expect(CLASS_DURATION_MINUTES).toBe(60);
    expect(toInstructorClass(snowDay)).toMatchObject({
      id: "class-1",
      resourceId: "1",
      name: "Izzy's PC Class",
      date: "2026-11-14",
      timeRange: "8:00 AM – 9:00 AM",
      dateLabel: "Saturday, November 14",
      cardDateLabel: "Sat, Nov 14",
      shortDateLabel: "11/14",
      enrolled: 1,
      capacity: 30,
      studentsLabel: "1/30 students",
    });
  });

  it("wraps the end time past noon and past midnight", () => {
    expect(toInstructorClass({ ...snowDay, class_date: "2026-11-14T11:30:00" }).timeRange).toBe("11:30 AM – 12:30 PM");
    expect(toInstructorClass({ ...snowDay, class_date: "2026-11-14T23:30:00" }).timeRange).toBe("11:30 PM – 12:30 AM");
  });

  it("describes enrollment when the class has no capacity", () => {
    expect(toInstructorClass({ ...snowDay, max_capacity: null, enrolled: 1 }).studentsLabel).toBe("1 student");
    expect(toInstructorClass({ ...snowDay, max_capacity: null, enrolled: 4 }).studentsLabel).toBe("4 students");
    expect(toInstructorClass({ ...snowDay, enrolled: null }).studentsLabel).toBe("0/30 students");
  });

  it("splits classes into today, upcoming, and past", () => {
    const groups = buildInstructorClasses([
      snowDay,
      { ...snowDay, class_id: 2, name_of_class: "Soldering Basics", class_date: "2026-11-04T18:00:00" },
      { ...snowDay, class_id: 3, name_of_class: "Lathe Safety", class_date: "2026-10-20T18:00:00" },
      { ...snowDay, class_id: 4, name_of_class: "Laser 101", class_date: "2026-11-20T10:00:00" },
    ], "2026-11-04");

    expect(groups.today.map((item) => item.name)).toEqual(["Soldering Basics"]);
    expect(groups.upcoming.map((item) => item.name)).toEqual(["Izzy's PC Class", "Laser 101"]);
    expect(groups.past.map((item) => item.name)).toEqual(["Lathe Safety"]);
  });

  it("drops rows with no usable date and tolerates empty input", () => {
    expect(buildInstructorClasses([{ ...snowDay, class_date: null }], "2026-11-04"))
      .toEqual({ today: [], upcoming: [], past: [] });
    expect(buildInstructorClasses(undefined, "2026-11-04"))
      .toEqual({ today: [], upcoming: [], past: [] });
  });
});
