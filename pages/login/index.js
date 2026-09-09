import Head from "next/head";
import Navbar from "@/components/Navbar";
import LoginForm from "@/components/LoginForm";
import styles from "@/styles/Login.module.css";

export default function LoginPage() {
  return (
    <>
      <Head>
        <title>Sign In - The Crafty Studio</title>
        <meta name="description" content="Sign in to your Crafty Studio account" />
      </Head>
      <div className={styles.pageContainer}>
        <Navbar />
        <main className={styles.mainContent}>
          <LoginForm />
        </main>
      </div>
    </>
  );
}

