import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import StaffNavbar from "@/components/StaffNavbar";
import MembershipStatusBadge from "@/components/MembershipStatusBadge";
import WeeklyAvailability from "@/components/WeeklyAvailability";
import styles from "@/styles/StaffPages.module.css";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { requireStaffPage } from "@/lib/staffAuth";
import { loadEquipment, loadRooms } from "@/lib/resources";
import { query } from "@/lib/db";
import { formatDate, formatTime } from "@/lib/format";
import { staffRequest } from "@/lib/staffApi";

const TABS = [
  { key: "equipment", label: "Equipment" },
  { key: "rooms", label: "Rooms" },
  { key: "classes", label: "Classes" },
];

// Upcoming classes with how many spots are taken
async function loadUpcomingClasses() {
  const withEnrollment = `
    SELECT c.class_id, c.name_of_class, c.description, c.class_date, c.max_capacity,
      COUNT(e.user_id)::integer AS enrolled
    FROM "class" c
    LEFT JOIN "class_enrollment" e ON e.class_id = c.class_id
    WHERE c.class_date > NOW()
    GROUP BY c.class_id
    ORDER BY c.class_date`;
  const { rows } = await query(withEnrollment).catch((error) => {
    // class_enrollment is created lazily on the first class booking
    if (error.code !== "42P01") throw error;
    return query(`SELECT class_id, name_of_class, description, class_date, max_capacity, 0 AS enrolled
                  FROM "class" WHERE class_date > NOW() ORDER BY class_date`);
  });
  return rows.map((row) => ({
    resourceId: String(row.class_id),
    name: row.name_of_class || "Class",
    description: row.description || "",
    time: [formatDate(row.class_date), formatTime(row.class_date)].filter(Boolean).join(" · "),
    spotsLeft: row.max_capacity ? Math.max(row.max_capacity - row.enrolled, 0) : null,
  }));
}

export async function getServerSideProps({ req, resolvedUrl, query: params }) {
  const guard = await requireStaffPage(req, resolvedUrl);
  if (guard.deny) return guard.deny;

  const [users, equipment, rooms, classes] = await Promise.all([
    new UserRepository().findAllWithMembership(),
    // Staff bookings skip Stripe, so list every machine without loading Stripe products
    loadEquipment({ stripe: false }),
    loadRooms(),
    loadUpcomingClasses(),
  ]);
  const members = users.map((user) => ({
    id: user.user_id,
    name: `${user.first_name} ${user.last_name}`.trim(),
    email: user.email,
    status: user.status || null,
  }));
  const requestedId = Number(params.userId);

  return {
    props: {
      navRole: guard.navRole,
      members,
      resources: { equipment, rooms, classes },
      initialMemberId: members.some((member) => member.id === requestedId) ? requestedId : null,
    },
  };
}

const wallTime = (day, minute) => `${day}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00`;

export default function NewStaffReservationPage({ navRole, members, resources, initialMemberId }) {
  const router = useRouter();
  const [memberId, setMemberId] = useState(initialMemberId);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("equipment");
  const [selectedResource, setSelectedResource] = useState(null);
  const [bookingClassId, setBookingClassId] = useState(null);
  const [error, setError] = useState("");

  const member = members.find((candidate) => candidate.id === memberId) || null;
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? members.filter((candidate) => candidate.name.toLowerCase().includes(term) || candidate.email.toLowerCase().includes(term))
      : members;
    return list.slice(0, 50);
  }, [members, search]);

  const book = (body) => staffRequest("/api/staff/reservations", "POST", { userId: memberId, ...body });
  const finish = () => router.push(`/members/${memberId}?booked=1`);

  // WeeklyAvailability shows its own error message when this throws
  const confirmSlots = async (periods) => {
    await book({
      type: activeTab,
      resourceId: selectedResource.resourceId,
      periods: periods.map(({ date, startMinute, endDate, endMinute }) => ({
        start: wallTime(date, startMinute),
        end: wallTime(endDate, endMinute),
      })),
    });
    await finish();
  };

  const bookClass = async (cls) => {
    if (!window.confirm(`Enroll ${member.name} in ${cls.name} (${cls.time})?`)) return;
    setBookingClassId(cls.resourceId);
    setError("");
    try {
      await book({ type: "classes", resourceId: cls.resourceId });
      await finish();
    } catch (bookingError) {
      setError(bookingError.message);
      setBookingClassId(null);
    }
  };

  const items = resources[activeTab];

  return (
    <>
      <Head>
        <title>New Reservation - The Crafty Studio</title>
      </Head>
      <div className={styles.page}>
        <StaffNavbar role={navRole} />
        <div className={styles.content}>
          <Link href={navRole === "admin" ? "/admin" : "/staff"} className={styles.backLink}>← Dashboard</Link>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Staff</p>
              <h1 className={styles.heading}>Create a Reservation</h1>
              <p className={styles.subheading}>Book equipment, rooms, or classes on behalf of a member.</p>
            </div>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}><span className={styles.stepNumber}>1</span>Member</h2>
            {member ? (
              <div className={styles.selectedMember}>
                <div>
                  <p className={styles.reservationName}>{member.name}</p>
                  <p className={styles.reservationMeta}>{member.email}</p>
                </div>
                <div className={styles.rowActions}>
                  <MembershipStatusBadge status={member.status} />
                  <button type="button" className={styles.secondaryBtn} onClick={() => setMemberId(null)}>Change</button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.toolbar}>
                  <input
                    type="search"
                    className={`${styles.input} ${styles.searchInput}`}
                    placeholder="Search members by name or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Search members"
                    autoFocus
                  />
                </div>
                <div className={styles.memberPicker}>
                  {matches.length === 0 && <p className={styles.emptyText}>No members match your search.</p>}
                  {matches.map((candidate) => (
                    <button key={candidate.id} type="button" className={styles.memberOption} onClick={() => setMemberId(candidate.id)}>
                      <span>
                        <strong>{candidate.name}</strong>
                        <span className={styles.muted}> · {candidate.email}</span>
                      </span>
                      <MembershipStatusBadge status={candidate.status} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {member && member.status !== "ACTIVE" && (
              <p className={styles.hint} style={{ marginTop: "0.75rem" }}>
                Heads up: this member doesn&apos;t have an active membership.
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}><span className={styles.stepNumber}>2</span>What to book</h2>
            <div className={styles.tabs} role="tablist" aria-label="Reservation type">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {!member && <p className={styles.hint} style={{ marginBottom: "0.75rem" }}>Choose a member first.</p>}

            {items.length === 0 ? (
              <p className={styles.emptyText}>
                {activeTab === "classes" ? "No upcoming classes." : `No ${activeTab} found.`}
              </p>
            ) : (
              <div className={styles.resourceGrid}>
                {activeTab === "classes"
                  ? items.map((cls) => {
                    const full = cls.spotsLeft === 0;
                    return (
                      <button
                        key={cls.resourceId}
                        type="button"
                        className={styles.resourceCard}
                        disabled={!member || full || bookingClassId !== null}
                        onClick={() => bookClass(cls)}
                      >
                        <span className={styles.resourceName}>{cls.name}</span>
                        <span className={styles.resourceMeta}>{cls.time}</span>
                        <span className={styles.resourceMeta}>
                          {bookingClassId === cls.resourceId ? "Enrolling…" : full ? "Class full" : cls.spotsLeft == null ? "Open enrollment" : `${cls.spotsLeft} spots left`}
                        </span>
                      </button>
                    );
                  })
                  : items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.resourceCard}
                      disabled={!member || item.unavailable}
                      onClick={() => setSelectedResource(item)}
                    >
                      <span className={styles.resourceName}>{item.name}</span>
                      {item.description && <span className={styles.resourceMeta}>{item.description}</span>}
                      <span className={styles.resourceMeta}>{item.unavailable ? "Unavailable" : "Pick a time →"}</span>
                    </button>
                  ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {selectedResource && member && (
        <WeeklyAvailability
          resource={selectedResource}
          type={activeTab}
          unavailableIntervals={selectedResource.unavailableIntervals}
          confirmLabel={`Book for ${member.name.split(" ")[0]}`}
          cancelLabel="Back"
          onClose={() => setSelectedResource(null)}
          onConfirm={confirmSlots}
        />
      )}
    </>
  );
}
