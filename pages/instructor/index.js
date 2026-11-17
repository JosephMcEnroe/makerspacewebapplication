import { Fragment, useMemo, useState } from "react";
import Head from "next/head";
import Navbar from "@/components/Navbar";
import { useAuthContext } from "@/context/AuthContext";
import styles from "@/styles/InstructorDashboard.module.css";
import { classRepository } from "@/Data_Access_Layer/classRepository";
import { requireInstructorPage } from "@/lib/instructorAuth";
import { buildInstructorClasses, studentsLabel } from "@/lib/instructorClasses";
import { businessDateTime } from "@/lib/businessTime";
import { DEFAULT_RESOURCE_IMAGE } from "@/lib/resourceImages";

// Only instructors can open this page; everyone else is sent to their own dashboard
export async function getServerSideProps({ req, resolvedUrl }) {
  const guard = await requireInstructorPage(req, resolvedUrl);
  if (guard.deny) return guard.deny;

  const repo = new classRepository();
  const [rows, enrollments] = await Promise.all([
    repo.findClassesByInstructor(guard.session.user.user_id),
    // Scoped to this instructor's classes in SQL, so no other roster is loaded
    repo.findEnrollmentsForInstructor(guard.session.user.user_id),
  ]);

  return {
    props: {
      classes: buildInstructorClasses(rows, businessDateTime().slice(0, 10), enrollments),
    },
  };
}

// Removes a student from one class and keeps its count in sync
function dropStudent(item, classId, studentId) {
  if (item.id !== classId) return item;
  const students = item.students.filter((student) => student.id !== studentId);
  return {
    ...item,
    students,
    enrolled: students.length,
    studentsLabel: studentsLabel(students.length, item.capacity),
  };
}

function ClassCard({ item, onOpenRoster, onEdit }) {
  const hasPhoto = item.image && item.image !== DEFAULT_RESOURCE_IMAGE;

  return (
    <article className={styles.card}>
      <div className={`${styles.cardImage} ${hasPhoto ? "" : styles.cardImageFallback}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image || DEFAULT_RESOURCE_IMAGE} alt="" className={styles.cardImageElement} />
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardTime}>{item.timeRange}</p>
        <h3 className={styles.cardName}>{item.name}</h3>
        <p className={styles.cardMeta}>{item.cardDateLabel} · {item.studentsLabel}</p>
        <div className={styles.cardActions}>
          <button type="button" className={styles.cardAction} onClick={() => onOpenRoster(item)}>
            View Students
          </button>
          <button type="button" className={styles.cardAction} onClick={() => onEdit(item)}>
            Edit Description
          </button>
        </div>
      </div>
    </article>
  );
}

function ClassSection({ title, items, emptyText, renderItem }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {items.length > 0
        ? <div className={styles.grid}>{items.map(renderItem)}</div>
        : <p className={styles.empty}>{emptyText}</p>}
    </section>
  );
}

export default function InstructorDashboardPage({ classes: initialClasses }) {
  const { user } = useAuthContext();
  const [expandedId, setExpandedId] = useState(null);
  const [classes, setClasses] = useState(initialClasses);
  const [rosterClassId, setRosterClassId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [rosterError, setRosterError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDescription, setEditDescription] = useState("");
  const [savingClass, setSavingClass] = useState(false);
  const [editError, setEditError] = useState("");

  const allClasses = useMemo(
    () => [...classes.today, ...classes.upcoming, ...classes.past],
    [classes]
  );
  const rosterClass = allClasses.find((item) => item.id === rosterClassId) || null;
  const editingClass = allClasses.find((item) => item.id === editingId) || null;

  const openRoster = (item) => {
    setRosterError("");
    setRosterClassId(item.id);
  };

  const closeRoster = () => {
    setRosterClassId(null);
    setRemovingId(null);
    setRosterError("");
  };

  const openEditor = (item) => {
    setEditError("");
    setEditDescription(item.description || "");
    setEditingId(item.id);
  };

  const closeEditor = () => {
    setEditingId(null);
    setEditError("");
    setSavingClass(false);
  };

  const saveDescription = async (event) => {
    event.preventDefault();
    if (!editingClass || savingClass) return;

    setSavingClass(true);
    setEditError("");

    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
      const { csrfToken } = await csrfResponse.json();

      const response = await fetch(`/api/instructor/classes/${editingClass.resourceId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ description: editDescription }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not save the description.");
      }

      const description = data.description || "";
      const withDescription = (item) =>
        item.id === editingClass.id ? { ...item, description } : item;

      setClasses((prev) => ({
        today: prev.today.map(withDescription),
        upcoming: prev.upcoming.map(withDescription),
        past: prev.past.map(withDescription),
      }));
      setEditingId(null);
    } catch (err) {
      setEditError(err.message || "Could not save the description.");
    } finally {
      setSavingClass(false);
    }
  };

  const removeStudent = async (classItem, student) => {
    setRemovingId(student.id);
    setRosterError("");

    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
      const { csrfToken } = await csrfResponse.json();

      const response = await fetch(`/api/instructor/classes/${classItem.resourceId}/enrollments`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ studentId: student.id }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not remove the student.");
      }

      setClasses((prev) => ({
        today: prev.today.map((item) => dropStudent(item, classItem.id, student.id)),
        upcoming: prev.upcoming.map((item) => dropStudent(item, classItem.id, student.id)),
        past: prev.past.map((item) => dropStudent(item, classItem.id, student.id)),
      }));
    } catch (err) {
      setRosterError(err.message || "Could not remove the student.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Instructor Dashboard - The Crafty Studio</title>
        <meta name="description" content="Manage the classes you teach at The Crafty Studio" />
      </Head>
      <Navbar />

      <main className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.greeting}>Hello, {user?.firstName || "Instructor"}!</h1>
          {/* Server and browser clocks can differ, so let the browser's date win */}
          <p className={styles.date} suppressHydrationWarning>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>

          <div className={styles.panel}>
            <ClassSection
              title="Today's Classes"
              items={classes.today}
              emptyText="No classes scheduled today."
              renderItem={(item) => <ClassCard key={item.id} item={item} onOpenRoster={openRoster} onEdit={openEditor} />}
            />

            <ClassSection
              title="Upcoming Classes"
              items={classes.upcoming}
              emptyText="No upcoming classes scheduled yet."
              renderItem={(item) => <ClassCard key={item.id} item={item} onOpenRoster={openRoster} onEdit={openEditor} />}
            />

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Past Classes</h2>
              {classes.past.length > 0 ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Status</th>
                        <th scope="col">Date</th>
                        <th scope="col">Class Name</th>
                        <th scope="col">Class Time</th>
                        <th scope="col">Students</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.past.map((item) => {
                        const isExpanded = expandedId === item.id;
                        return (
                          <Fragment key={item.id}>
                            <tr>
                              <td><span className={styles.statusPill}>Completed</span></td>
                              <td>{item.shortDateLabel}</td>
                              <td className={styles.className}>{item.name}</td>
                              <td>{item.timeRange}</td>
                              <td>{item.studentsLabel}</td>
                              <td>
                                <div className={styles.rowActions}>
                                  <button
                                    type="button"
                                    className={styles.detailsButton}
                                    aria-expanded={isExpanded}
                                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                  >
                                    More Details
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.detailsButton}
                                    onClick={() => openRoster(item)}
                                  >
                                    Students
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.detailsButton}
                                    onClick={() => openEditor(item)}
                                  >
                                    Description
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className={styles.detailsCell}>
                                  <p className={styles.detailsDate}>{item.dateLabel}</p>
                                  <p>{item.description || "No description was added to this class."}</p>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.empty}>No past classes yet.</p>
              )}
            </section>
          </div>
        </div>
      </main>

      {rosterClass && (
        <div className={styles.modalBackdrop}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rosterTitle"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="rosterTitle" className={styles.modalTitle}>{rosterClass.name}</h2>
                <p className={styles.modalMeta}>
                  {rosterClass.cardDateLabel} · {rosterClass.timeRange} · {rosterClass.studentsLabel}
                </p>
              </div>
              <button type="button" className={styles.modalClose} onClick={closeRoster}>
                Close
              </button>
            </div>

            {rosterError && <p className={styles.rosterError} role="alert">{rosterError}</p>}

            {rosterClass.students.length > 0 ? (
              <ul className={styles.rosterList}>
                {rosterClass.students.map((student) => (
                  <li key={student.id} className={styles.rosterRow}>
                    <div>
                      <p className={styles.rosterName}>{student.name}</p>
                      {student.email && <p className={styles.rosterEmail}>{student.email}</p>}
                    </div>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => removeStudent(rosterClass, student)}
                      disabled={removingId === student.id}
                    >
                      {removingId === student.id ? "Removing..." : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No students are enrolled in this class.</p>
            )}
          </div>
        </div>
      )}

      {editingClass && (
        <div className={styles.modalBackdrop}>
          <form
            className={styles.modal}
            onSubmit={saveDescription}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editClassTitle"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="editClassTitle" className={styles.modalTitle}>
                  {editingClass.name}
                </h2>
                <p className={styles.modalMeta}>
                  {editingClass.cardDateLabel} · {editingClass.timeRange} · {editingClass.studentsLabel}
                </p>
              </div>
              <button type="button" className={styles.modalClose} onClick={closeEditor}>
                Cancel
              </button>
            </div>

            {editError && <p className={styles.rosterError} role="alert">{editError}</p>}

            <label className={styles.fieldLabel} htmlFor="class-description">Description</label>
            <textarea
              id="class-description"
              name="description"
              className={styles.fieldTextarea}
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="What will students learn in this class?"
            />
            <p className={styles.fieldHint}>
              Only the description can be edited here. Contact staff to change the name, schedule or capacity.
            </p>

            <div className={styles.modalActions}>
              <button type="button" className={styles.modalClose} onClick={closeEditor}>
                Cancel
              </button>
              <button type="submit" className={styles.saveButton} disabled={savingClass}>
                {savingClass ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
