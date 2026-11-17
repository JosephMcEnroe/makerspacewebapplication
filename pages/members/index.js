import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import StaffNavbar from "@/components/StaffNavbar";
import MembershipStatusBadge from "@/components/MembershipStatusBadge";
import styles from "@/styles/StaffPages.module.css";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { requireStaffPage } from "@/lib/staffAuth";
import { formatDate } from "@/lib/format";

// Staff-only member directory
export async function getServerSideProps({ req, resolvedUrl }) {
  const guard = await requireStaffPage(req, resolvedUrl);
  if (guard.deny) return guard.deny;

  const rows = await new UserRepository().findAllWithMembership();
  const members = rows.map((row) => ({
    id: row.user_id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    phone: row.phone_number || "",
    role: row.role_of_membership || null,
    status: row.status || null,
    periodEnd: formatDate(row.period_end_date),
    waiverSigned: row.waiver_status === true,
  }));

  return { props: { members, navRole: guard.navRole } };
}

const PAGE_SIZE = 15;

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

function Pagination({ total, page, pageCount, setPage }) {
  if (pageCount <= 1) return null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <nav className={styles.pagination} aria-label="Member pages">
      <span className={styles.pageInfo}>{first}–{last} of {total}</span>
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

export default function MembersPage({ members, navRole }) {
  const [search, setSearchValue] = useState("");
  const [statusFilter, setStatusFilterValue] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      if (statusFilter === "none" ? member.status : statusFilter !== "all" && member.status !== statusFilter) return false;
      return !term || [member.name, member.email, member.phone].some((value) => value.toLowerCase().includes(term));
    });
  }, [members, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // A new search or filter starts back on page 1
  const setSearch = (value) => { setSearchValue(value); setPage(1); };
  const setStatusFilter = (value) => { setStatusFilterValue(value); setPage(1); };

  return (
    <>
      <Head>
        <title>Members - The Crafty Studio</title>
      </Head>
      <div className={styles.page}>
        <StaffNavbar role={navRole} />
        <div className={styles.content}>
          <Link href={navRole === "admin" ? "/admin" : "/staff"} className={styles.backLink}>← Dashboard</Link>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Staff</p>
              <h1 className={styles.heading}>Members</h1>
              <p className={styles.subheading}>{members.length} accounts · select a member to manage their membership</p>
            </div>
            <Link href="/staff/reservations/new" className={styles.primaryBtn}>+ New Reservation</Link>
          </div>

          <div className={styles.panel}>
            <div className={styles.toolbar}>
              <input
                type="search"
                className={`${styles.input} ${styles.searchInput}`}
                placeholder="Search by name, email, or phone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search members"
              />
              <select
                className={styles.select}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by membership status"
              >
                <option value="all">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="none">No membership</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <p className={styles.emptyText}>No members match your search.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">Ends</th>
                      <th scope="col" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <Link href={`/members/${member.id}`} className={styles.memberName}>{member.name}</Link>
                          {!member.waiverSigned && <div className={styles.hint}>Waiver not signed</div>}
                        </td>
                        <td className={styles.muted}>
                          {member.email}
                          {member.phone && <div>{member.phone}</div>}
                        </td>
                        <td>{member.role ? <span className={`${styles.badge} ${styles.badgeRole}`}>{member.role.toLowerCase()}</span> : <span className={styles.muted}>—</span>}</td>
                        <td><MembershipStatusBadge status={member.status} /></td>
                        <td className={styles.muted}>{member.periodEnd || "—"}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <Link href={`/staff/reservations/new?userId=${member.id}`} className={styles.secondaryBtn}>Book</Link>
                            <Link href={`/members/${member.id}`} className={styles.primaryBtn}>Manage</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination total={filtered.length} page={currentPage} pageCount={pageCount} setPage={setPage} />
          </div>
        </div>
      </div>
    </>
  );
}
