import Head from "next/head";
import DashboardLayout from "@/components/DashboardLayout";
import MembershipCard from "@/components/MembershipCard";
import styles from "@/styles/Account.module.css";

// Placeholder until membership data is wired up to the database
const MOCK_ACCOUNT = {
  accountId: "123456",
  firstName: "Alex",
  lastName: "Chen",
  memberSince: "2025",
};

const MOCK_MEMBERSHIP = {
  planName: "Alex's Membership",
  status: "active",
  monthlyCost: 95.0,
  nextBillingDate: "May 1, 2026",
  autoRenew: false,
};

export default function MembershipPage() {
  return (
    <>
      <Head>
        <title>Membership Management - The Crafty Studio</title>
        <meta name="description" content="Manage your Crafty Studio membership" />
      </Head>
      <DashboardLayout user={{ name: `${MOCK_ACCOUNT.firstName} ${MOCK_ACCOUNT.lastName}`, memberSince: MOCK_ACCOUNT.memberSince }}>
        <h1 className={styles.title}>MEMBERSHIP MANAGEMENT</h1>
        <p className={styles.subtitle}>Account ID: {MOCK_ACCOUNT.accountId}</p>
        <MembershipCard membership={MOCK_MEMBERSHIP} />
      </DashboardLayout>
    </>
  );
}
