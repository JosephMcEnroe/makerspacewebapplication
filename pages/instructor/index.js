import { Fragment, useState } from "react";
import Head from "next/head";
import Navbar from "@/components/Navbar";
import { useAuthContext } from "@/context/AuthContext";
import styles from "@/styles/InstructorDashboard.module.css";
import { classRepository } from "@/Data_Access_Layer/classRepository";
import { requireInstructorPage } from "@/lib/instructorAuth";
import { buildInstructorClasses } from "@/lib/instructorClasses";
import { businessDateTime } from "@/lib/businessTime";
import { DEFAULT_RESOURCE_IMAGE } from "@/lib/resourceImages";

// Only instructors can open this page; everyone else is sent to their own dashboard
export async function getServerSideProps({ req, resolvedUrl }) {
  const guard = await requireInstructorPage(req, resolvedUrl);
  if (guard.deny) return guard.deny;

  const rows = await new classRepository().findClassesByInstructor(guard.session.user.user_id);
  return { props: { classes: buildInstructorClasses(rows, businessDateTime().slice(0, 10)) } };
}

function ClassCard({ item }) {
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

export default function InstructorDashboardPage({ classes }) {
  const { user } = useAuthContext();
  const [expandedId, setExpandedId] = useState(null);

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
              renderItem={(item) => <ClassCard key={item.id} item={item} />}
            />

            <ClassSection
              title="Upcoming Classes"
              items={classes.upcoming}
              emptyText="No upcoming classes scheduled yet."
              renderItem={(item) => <ClassCard key={item.id} item={item} />}
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
                                <button
                                  type="button"
                                  className={styles.detailsButton}
                                  aria-expanded={isExpanded}
                                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                >
                                  More Details
                                </button>
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
    </>
  );
}
