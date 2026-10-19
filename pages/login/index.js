import Head from "next/head";
import LoginForm from "@/components/LoginForm";
import styles from "@/styles/Login.module.css";

export default function LoginPage() {
  return (
    <>
      <Head>
        <title>Sign In - The Collaboratory</title>
        <meta name="description" content="Sign in to your Collaboratory account" />
      </Head>
      <div className={styles.pageContainer}>
        <main className={styles.mainContent}>
          <LoginForm />
        </main>
      </div>
    </>
  );
}

