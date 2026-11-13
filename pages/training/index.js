import Head from "next/head";
import { useMemo, useState } from "react";
import StaffNavbar from "@/components/StaffNavbar";
import styles from "@/styles/TrainingApprovals.module.css";
import { trainingRepository } from "@/Data_Access_Layer/trainingRepository";
import { requireStaffPage } from "@/lib/staffAuth";
import { staffRequest } from "@/lib/staffApi";
import { formatDate, formatTime } from "@/lib/format";
import { getTrainingModule } from "@/lib/trainingContent";

function toRecord(row) {
  const trainingModule = getTrainingModule(row.equipment_key);
  const reviewer = [row.reviewer_first_name, row.reviewer_last_name].filter(Boolean).join(" ");
  return {
    id: row.training_id,
    memberId: row.user_id,
    memberName: `${row.first_name} ${row.last_name}`.trim() || row.email,
    memberEmail: row.email,
    machine: trainingModule?.name || row.equipment_key,
    model: trainingModule?.model || "",
    status: row.status,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    completedDate: formatDate(row.completed_at),
    completedTime: formatTime(row.completed_at),
    reviewer: reviewer || null,
  };
}

// Staff-only: approve or deny equipment training members have completed
export async function getServerSideProps({ req, resolvedUrl }) {
  const guard = await requireStaffPage(req, resolvedUrl);
  if (guard.deny) return guard.deny;

  const rows = await new trainingRepository().findAllWithMembers();
  return { props: { records: rows.map(toRecord), navRole: guard.navRole } };
}

function initials(name) {
  return name.split(/\s+/).map((part) => part.charAt(0).toUpperCase()).slice(0, 2).join("");
}

const PAGE_SIZE = 10;

// Search, date sort, and pagination for one table
function useFilteredRecords(records, defaultSort) {
  const [search, setSearchValue] = useState("");
  const [sort, setSortValue] = useState(defaultSort);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = records.filter((record) =>
      !term || [record.memberName, record.memberEmail, record.machine, record.model].some((value) => value?.toLowerCase().includes(term))
    );
    const direction = sort === "earliest" ? 1 : -1;
    return matches.sort((a, b) => direction * String(a.completedAt).localeCompare(String(b.completedAt)));
  }, [records, search, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp so approving the last row on a page doesn't leave an empty page
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // A new search or sort starts back on page 1
  const setSearch = (value) => { setSearchValue(value); setPage(1); };
  const setSort = (value) => { setSortValue(value); setPage(1); };

  return { filtered, pageRows, page: currentPage, pageCount, setPage, search, setSearch, sort, setSort };
}

// First, last, and up to two pages either side of the current one;
// null marks a gap ("…"). e.g. page 6 of 12 -> 1 … 4 5 6 7 8 … 12
function pageNumbers(page, pageCount) {
  const numbers = [];
  for (let number = 1; number <= pageCount; number += 1) {
    if (number === 1 || number === pageCount || Math.abs(number - page) <= 2) {
      if (numbers.length && number - numbers[numbers.length - 1] > 1) numbers.push(null);
      numbers.push(number);
    }
  }
  return numbers;
}

function Pagination({ filtered, page, pageCount, setPage, label }) {
  if (pageCount <= 1) return null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, filtered.length);
  return (
    <nav className={styles.pagination} aria-label={`${label} pages`}>
      <span className={styles.pageInfo}>{first}–{last} of {filtered.length}</span>
      <div className={styles.pageButtons}>
        <button type="button" className={styles.pageBtn} onClick={() => setPage(page - 1)} disabled={page === 1}>
          ‹ Prev
        </button>
        {pageNumbers(page, pageCount).map((number, index) => number === null ? (
          <span key={`gap-${index}`} className={styles.pageGap} aria-hidden="true">…</span>
        ) : (
          <button
            key={number}
            type="button"
            className={`${styles.pageBtn} ${number === page ? styles.pageBtnActive : ""}`}
            onClick={() => setPage(number)}
            aria-current={number === page ? "page" : undefined}
          >
            {number}
          </button>
        ))}
        <button type="button" className={styles.pageBtn} onClick={() => setPage(page + 1)} disabled={page === pageCount}>
          Next ›
        </button>
      </div>
    </nav>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </svg>
  );
}

function Toolbar({ label, search, setSearch, sort, setSort }) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.searchBox}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder="Search name or machine"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={`Search ${label}`}
        />
      </label>
      <select className={styles.select} value={sort} onChange={(event) => setSort(event.target.value)} aria-label={`Sort ${label} by date`}>
        <option value="earliest">Date: earliest</option>
        <option value="latest">Date: latest</option>
      </select>
    </div>
  );
}

function MemberCell({ record }) {
  return (
    <div className={styles.member}>
      <span className={styles.avatar} aria-hidden="true">{initials(record.memberName)}</span>
      <div>
        <div className={styles.primaryText}>{record.memberName}</div>
        <div className={styles.secondaryText}>{record.memberEmail}</div>
      </div>
    </div>
  );
}

function MachineAndDateCells({ record }) {
  return (
    <>
      <td data-label="Machine">
        <div className={styles.primaryText}>{record.machine}</div>
        {record.model && <div className={styles.secondaryText}>{record.model}</div>}
      </td>
      <td data-label="Completed">
        <div className={styles.date}>
          <CalendarIcon />
          <div>
            <div>{record.completedDate}</div>
            <div className={styles.secondaryText}>{record.completedTime}</div>
          </div>
        </div>
      </td>
    </>
  );
}

export default function TrainingApprovalsPage({ records: initialRecords, navRole }) {
  const [records, setRecords] = useState(initialRecords);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const pendingRecords = useMemo(() => records.filter((record) => record.status === "PENDING"), [records]);
  const reviewedRecords = useMemo(() => records.filter((record) => record.status !== "PENDING"), [records]);
  const approvedCount = reviewedRecords.filter((record) => record.status === "APPROVED").length;

  const pending = useFilteredRecords(pendingRecords, "earliest");
  const reviewed = useFilteredRecords(reviewedRecords, "latest");

  const review = async (record, decision) => {
    setBusyId(record.id);
    setError("");
    try {
      const result = await staffRequest(`/api/staff/training/${record.id}`, "PATCH", { decision });
      setRecords((current) => current.map((item) => (item.id === record.id ? { ...item, status: result.training.status } : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Training Approvals - The Crafty Studio</title>
      </Head>
      <div className={styles.page}>
        <StaffNavbar role={navRole} />
        <main className={styles.content}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.heading}>Training Approvals</h1>
              <p className={styles.subheading}>Review equipment training and track approved certifications.</p>
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Pending</span>
                <span className={styles.statValue}>{pendingRecords.length}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Approved</span>
                <span className={styles.statValue}>{approvedCount}</span>
              </div>
            </div>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <section className={styles.panel} aria-labelledby="pending-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="pending-title" className={styles.panelTitle}>
                  Pending training <span className={styles.count}>{pendingRecords.length}</span>
                </h2>
                <p className={styles.panelSubtitle}>Completed sessions that need staff review and approval.</p>
              </div>
              <Toolbar label="pending training" {...pending} />
            </div>

            {pending.filtered.length === 0 ? (
              <p className={styles.empty}>
                {pendingRecords.length === 0 ? "No training waiting for review." : "No pending training matches your search."}
              </p>
            ) : (
              <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Member</th>
                      <th scope="col">Machine</th>
                      <th scope="col">Completed</th>
                      <th scope="col" className={styles.alignRight}>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.pageRows.map((record) => (
                      <tr key={record.id}>
                        <td><MemberCell record={record} /></td>
                        <MachineAndDateCells record={record} />
                        <td className={styles.alignRight}>
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={styles.denyBtn}
                              onClick={() => review(record, "deny")}
                              disabled={busyId !== null}
                              aria-label={`Deny ${record.machine} training for ${record.memberName}`}
                            >
                              Deny
                            </button>
                            <button
                              type="button"
                              className={styles.approveBtn}
                              onClick={() => review(record, "approve")}
                              disabled={busyId !== null}
                              aria-label={`Approve ${record.machine} training for ${record.memberName}`}
                            >
                              {busyId === record.id ? "Saving…" : "Approve"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination label="Pending training" {...pending} />
              </>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="completed-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="completed-title" className={styles.panelTitle}>
                  Completed training <span className={styles.count}>{reviewedRecords.length}</span>
                </h2>
                <p className={styles.panelSubtitle}>Reviewed training and certification history.</p>
              </div>
              <Toolbar label="completed training" {...reviewed} />
            </div>

            {reviewed.filtered.length === 0 ? (
              <p className={styles.empty}>
                {reviewedRecords.length === 0 ? "No reviewed training yet." : "No completed training matches your search."}
              </p>
            ) : (
              <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Member</th>
                      <th scope="col">Machine</th>
                      <th scope="col">Completed</th>
                      <th scope="col" className={styles.alignRight}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewed.pageRows.map((record) => (
                      <tr key={record.id}>
                        <td><MemberCell record={record} /></td>
                        <MachineAndDateCells record={record} />
                        <td className={styles.alignRight}>
                          <span className={record.status === "APPROVED" ? styles.badgeApproved : styles.badgeDenied}>
                            {record.status === "APPROVED" ? "Approved" : "Denied"}
                          </span>
                          {record.reviewer && <div className={styles.secondaryText}>by {record.reviewer}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination label="Completed training" {...reviewed} />
              </>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
