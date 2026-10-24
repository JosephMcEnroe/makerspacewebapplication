import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import StaffNavbar from "@/components/StaffNavbar";
import MembershipStatusBadge from "@/components/MembershipStatusBadge";
import styles from "@/styles/StaffPages.module.css";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { membershipRepositry } from "@/Data_Access_Layer/MembershipRepository";
import { StaffRepository } from "@/Data_Access_Layer/staffRepository";
import { adminRepository } from "@/Data_Access_Layer/adminRepository";
import { requireStaffPage } from "@/lib/staffAuth";
import { businessDateTime } from "@/lib/businessTime";
import { formatDate, formatTime, formatTimeRange, toISODate } from "@/lib/format";
import { reservationCustomerEndDateTime } from "@/lib/reservationPeriods";
import { staffRequest } from "@/lib/staffApi";

const ROLES = ["MEMBER", "STUDENT", "INSTRUCTOR", "STAFF", "ADMIN"];
const TYPE_LABELS = { room: "Room", equipment: "Equipment", class: "Class" };

export async function getServerSideProps({ req, resolvedUrl, params }) {
  const guard = await requireStaffPage(req, resolvedUrl);
  if (guard.deny) return guard.deny;

  const memberId = Number(params.id);
  if (!Number.isInteger(memberId) || memberId < 1) return { notFound: true };

  const [user, membership, reservations, targetIsAdmin] = await Promise.all([
    new UserRepository().findById(memberId),
    new membershipRepositry().findUserMembership(memberId),
    new StaffRepository().findUserReservations(memberId),
    new adminRepository().isAdmin(memberId),
  ]);
  if (!user) return { notFound: true };

  const now = Date.now();
  const cards = reservations
    .map((reservation) => {
      const cancelled = !!reservation.status && reservation.status.toLowerCase().startsWith("cancel");
      const endsAt = reservation.end_at instanceof Date ? reservation.end_at.getTime() : 0;
      return {
        key: `${reservation.type}-${reservation.id}`,
        id: reservation.id,
        type: reservation.type,
        name: reservation.name || TYPE_LABELS[reservation.type],
        time: reservation.type === "class"
          ? [formatDate(reservation.start_at), formatTime(reservation.start_at)].filter(Boolean).join(" · ")
          : formatTimeRange(reservation.start_at, reservation.type === "equipment"
            ? reservationCustomerEndDateTime(reservation.end_at, 15) || reservation.end_at
            : reservation.end_at),
        sortAt: reservation.start_at instanceof Date ? reservation.start_at.getTime() : 0,
        state: cancelled ? "cancelled" : endsAt >= now ? "upcoming" : "past",
      };
    })
    .sort((a, b) => a.sortAt - b.sortAt);

  const today = businessDateTime().slice(0, 10);
  const nextMonth = new Date(`${today}T12:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  return {
    props: {
      navRole: guard.navRole,
      viewerIsAdmin: guard.session.isAdmin,
      canEdit: !targetIsAdmin || guard.session.isAdmin,
      member: {
        id: user.user_id,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
        notes: user.notes || "",
        waiver_status: user.waiver_status === true,
        dateOfBirth: formatDate(user.date_of_birth),
      },
      membership: {
        exists: !!membership,
        role_of_membership: membership?.role_of_membership || "MEMBER",
        status: membership?.status || "ACTIVE",
        period_start_date: toISODate(membership?.period_start_date) || today,
        period_end_date: toISODate(membership?.period_end_date) || nextMonth.toISOString().slice(0, 10),
        rfid_id: membership?.rfid_id || "",
        auto_renew: membership?.auto_renew === true,
        hasStripe: !!membership?.stripe_subscription_id,
      },
      upcoming: cards.filter((card) => card.state === "upcoming"),
      history: cards.filter((card) => card.state !== "upcoming").reverse().slice(0, 15),
    },
  };
}

export default function MemberDetailPage({ navRole, viewerIsAdmin, canEdit, member, membership, upcoming, history }) {
  const router = useRouter();
  const [details, setDetails] = useState(member);
  const [plan, setPlan] = useState(membership);
  const [saving, setSaving] = useState(null);
  const [cancellingKey, setCancellingKey] = useState(null);
  const [message, setMessage] = useState(router.query.booked ? { type: "success", text: "Reservation created." } : null);

  const refresh = () => router.replace(router.asPath.split("?")[0], undefined, { scroll: false });

  const save = async (section, body, successText) => {
    setSaving(section);
    setMessage(null);
    try {
      await staffRequest(`/api/staff/members/${member.id}`, "PATCH", body);
      setMessage({ type: "success", text: successText });
      await refresh();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(null);
    }
  };

  const saveDetails = (event) => {
    event.preventDefault();
    save("details", { user: details }, "Member details saved.");
  };

  const saveMembership = (event) => {
    event.preventDefault();
    save("membership", { membership: plan }, "Membership saved.");
  };

  const cancelReservation = async (reservation) => {
    if (!window.confirm(`Cancel ${reservation.name} (${reservation.time}) for ${member.first_name}?`)) return;
    setCancellingKey(reservation.key);
    setMessage(null);
    try {
      await staffRequest("/api/staff/reservations/cancel", "POST", {
        userId: member.id,
        type: reservation.type,
        reservationId: reservation.id,
      });
      setMessage({ type: "success", text: "Reservation cancelled." });
      await refresh();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setCancellingKey(null);
    }
  };

  const updateDetails = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setDetails((current) => ({ ...current, [field]: value }));
  };
  const updatePlan = (field) => (event) => setPlan((current) => ({ ...current, [field]: event.target.value }));

  return (
    <>
      <Head>
        <title>{`${member.first_name} ${member.last_name} - Members - The Crafty Studio`}</title>
      </Head>
      <div className={styles.page}>
        <StaffNavbar role={navRole} />
        <div className={styles.content}>
          <Link href="/members" className={styles.backLink}>← All members</Link>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Member #{member.id}</p>
              <h1 className={styles.heading}>{member.first_name} {member.last_name}</h1>
              <p className={styles.subheading}>
                <MembershipStatusBadge status={membership.exists ? membership.status : null} />
                {membership.exists && <> · {membership.role_of_membership.toLowerCase()} · ends {formatDate(membership.period_end_date)}</>}
              </p>
            </div>
            <Link href={`/staff/reservations/new?userId=${member.id}`} className={styles.primaryBtn}>+ New Reservation</Link>
          </div>

          {message && (
            <p className={message.type === "error" ? styles.error : styles.success} role={message.type === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          )}
          {!canEdit && <p className={styles.error}>This is an admin account. Only admins can edit it.</p>}

          <form className={styles.panel} onSubmit={saveMembership}>
            <h2 className={styles.panelTitle}>Membership</h2>
            {!membership.exists && <p className={styles.hint} style={{ marginBottom: "1rem" }}>This member has no membership yet — saving will create one.</p>}
            <fieldset disabled={!canEdit} style={{ border: "none" }}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  Status
                  <select className={styles.select} value={plan.status} onChange={updatePlan("status")}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
                <label className={styles.field}>
                  Role
                  <select className={styles.select} value={plan.role_of_membership} onChange={updatePlan("role_of_membership")} disabled={!viewerIsAdmin}>
                    {ROLES.map((role) => <option key={role} value={role}>{role.charAt(0) + role.slice(1).toLowerCase()}</option>)}
                  </select>
                  {!viewerIsAdmin && <span className={styles.hint}>Only admins can change roles.</span>}
                </label>
                <label className={styles.field}>
                  Period start
                  <input type="date" className={styles.input} value={plan.period_start_date} onChange={updatePlan("period_start_date")} required />
                </label>
                <label className={styles.field}>
                  Period end
                  <input type="date" className={styles.input} value={plan.period_end_date} onChange={updatePlan("period_end_date")} required />
                </label>
                <label className={`${styles.field} ${styles.fullWidth}`}>
                  RFID card
                  <input className={styles.input} value={plan.rfid_id} onChange={updatePlan("rfid_id")} placeholder="Scan or type the card ID" />
                </label>
              </div>
              {membership.hasStripe && (
                <p className={styles.hint} style={{ marginTop: "0.75rem" }}>
                  Billed through Stripe · auto-renew {membership.auto_renew ? "on" : "off"}. Billing changes still happen in Stripe.
                </p>
              )}
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={saving !== null}>
                  {saving === "membership" ? "Saving…" : membership.exists ? "Save Membership" : "Create Membership"}
                </button>
              </div>
            </fieldset>
          </form>

          <form className={styles.panel} onSubmit={saveDetails}>
            <h2 className={styles.panelTitle}>Member Details</h2>
            <fieldset disabled={!canEdit} style={{ border: "none" }}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  First name
                  <input className={styles.input} value={details.first_name} onChange={updateDetails("first_name")} required />
                </label>
                <label className={styles.field}>
                  Last name
                  <input className={styles.input} value={details.last_name} onChange={updateDetails("last_name")} required />
                </label>
                <label className={styles.field}>
                  Email
                  <input type="email" className={styles.input} value={details.email} onChange={updateDetails("email")} required />
                </label>
                <label className={styles.field}>
                  Phone
                  <input type="tel" className={styles.input} value={details.phone_number} onChange={updateDetails("phone_number")} />
                </label>
                <label className={`${styles.field} ${styles.fullWidth}`}>
                  Staff notes
                  <textarea className={styles.textarea} value={details.notes} onChange={updateDetails("notes")} />
                </label>
                <label className={styles.checkboxField}>
                  <input type="checkbox" checked={details.waiver_status} onChange={updateDetails("waiver_status")} />
                  Waiver signed
                </label>
                {member.dateOfBirth && <p className={styles.hint}>Date of birth: {member.dateOfBirth}</p>}
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={saving !== null}>
                  {saving === "details" ? "Saving…" : "Save Details"}
                </button>
              </div>
            </fieldset>
          </form>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Reservations</h2>
            <p className={styles.sectionLabel}>Upcoming</p>
            {upcoming.length === 0 ? (
              <p className={styles.emptyText}>No upcoming reservations.</p>
            ) : (
              <div className={styles.reservationList}>
                {upcoming.map((reservation) => (
                  <div key={reservation.key} className={styles.reservationItem}>
                    <div>
                      <p className={styles.reservationName}>{reservation.name}</p>
                      <p className={styles.reservationMeta}>{TYPE_LABELS[reservation.type]} · {reservation.time}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      onClick={() => cancelReservation(reservation)}
                      disabled={cancellingKey !== null}
                    >
                      {cancellingKey === reservation.key ? "Cancelling…" : "Cancel"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {history.length > 0 && (
              <>
                <p className={styles.sectionLabel}>Recent history</p>
                <div className={styles.reservationList}>
                  {history.map((reservation) => (
                    <div key={reservation.key} className={styles.reservationItem}>
                      <div>
                        <p className={styles.reservationName}>{reservation.name}</p>
                        <p className={styles.reservationMeta}>{TYPE_LABELS[reservation.type]} · {reservation.time}</p>
                      </div>
                      <span className={`${styles.badge} ${reservation.state === "cancelled" ? styles.badgeInactive : styles.badgeNone}`}>
                        {reservation.state}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
