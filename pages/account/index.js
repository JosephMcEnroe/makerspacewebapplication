import Head from "next/head";
import AccountInfoForm from "@/components/AccountInfoForm";
import styles from "@/styles/Account.module.css";

import { useAuth } from "@/hooks/useAuth";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { getSessionUser, loginRedirect } from "@/lib/session";
import { formatYear, toISODate } from "@/lib/format";

export async function getServerSideProps({ req, resolvedUrl }) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return loginRedirect(resolvedUrl);
  }

  const userQuery = new UserRepository();
  const dbUser = await userQuery.findById(sessionUser.user_id);
  if (!dbUser) {
    return loginRedirect(resolvedUrl);
  }

  return {
    props: {
      account: {
        firstName: dbUser.first_name ?? "",
        lastName: dbUser.last_name ?? "",
        dateOfBirth: toISODate(dbUser.date_of_birth),
        email: dbUser.email ?? "",
        phoneNumber: dbUser.phone_number ?? "",
        memberSince: formatYear(sessionUser.period_start_date),
      },
    },
  };
}

export default function AccountPage({ account }) {
  //add the user auth check here
  const { user, loading } = useAuth();

  //figure out how to block the page access (not just the page, include everything - the sidebar, the navigation bar, etc.)
  if(loading){
    return <p>Checking authentication...</p>;
  }

  //Come back to this later
  // if(user.role !== "member"){
  //   return <p>Not authorized...</p>;
  // }

  return (
    <>
      <Head>
        <title>Account Information - The Crafty Studio</title>
        <meta name="description" content="Manage your Crafty Studio account information" />
      </Head>
      <h1 className={styles.title}>ACCOUNT INFORMATION</h1>
      <AccountInfoForm account={account} />
    </>
  );
}
