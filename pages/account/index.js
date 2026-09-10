import Head from "next/head";
import DashboardLayout from "@/components/DashboardLayout";
import AccountInfoForm from "@/components/AccountInfoForm";
import styles from "@/styles/Account.module.css";

// Placeholder until account data is wired up to the database
const MOCK_ACCOUNT = {
  accountId: "123456",
  firstName: "Alex",
  lastName: "Chen",
  dateOfBirth: "",
  email: "alex.chen@email.com",
  phoneNumber: "(555) 123-4567",
  memberSince: "2025",
};

export default function AccountPage() {
  return (
    <>
      <Head>
        <title>Account Information - The Crafty Studio</title>
        <meta name="description" content="Manage your Crafty Studio account information" />
      </Head>
      <DashboardLayout user={{ name: `${MOCK_ACCOUNT.firstName} ${MOCK_ACCOUNT.lastName}`, memberSince: MOCK_ACCOUNT.memberSince }}>
        <h1 className={styles.title}>ACCOUNT INFORMATION</h1>
        <p className={styles.subtitle}>Account ID: {MOCK_ACCOUNT.accountId}</p>
        <AccountInfoForm account={MOCK_ACCOUNT} />
      </DashboardLayout>
    </>
  );
}
