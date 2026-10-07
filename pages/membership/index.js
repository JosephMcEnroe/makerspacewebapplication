import Head from "next/head";
import MembershipCard from "@/components/MembershipCard";
import styles from "@/styles/Account.module.css";
import { membershipRepositry } from "@/Data_Access_Layer/MembershipRepository";
import { paymentRepository } from "@/Data_Access_Layer/paymentRepository";
import { getSessionUser, loginRedirect } from "@/lib/session";
import { formatDate } from "@/lib/format";

export async function getServerSideProps({ req, resolvedUrl }) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return loginRedirect(resolvedUrl);
  }

  const [membership, payments] = await Promise.all([
    new membershipRepositry().findUserMembership(sessionUser.user_id),
    new paymentRepository().findUserPayments(sessionUser.user_id),
  ]);

  // Payments are ordered newest first - the latest one is the current rate
  const latestPayment = payments[0];

  return {
    props: {
      accountId: String(sessionUser.user_id),
      membership: {
        planName: sessionUser.first_name ? `${sessionUser.first_name}'s Membership` : "Membership",
        status: (membership?.status ?? "").toLowerCase(),
        monthlyCost: latestPayment ? Number(latestPayment.amount) : null,
        nextBillingDate: formatDate(membership?.period_end_date),
      },
    },
  };
}

export default function MembershipPage({ accountId, membership }) {
  return (
    <>
      <Head>
        <title>Membership Management - The Crafty Studio</title>
        <meta name="description" content="Manage your Crafty Studio membership" />
      </Head>
      <h1 className={styles.title}>MEMBERSHIP MANAGEMENT</h1>
      <p className={styles.subtitle}>Account ID: {accountId}</p>
      <MembershipCard membership={membership} />
    </>
  );
}
