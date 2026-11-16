import Head from "next/head";
import Navbar from "@/components/Navbar";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import styles from "@/styles/Login.module.css";

export default function ForgotPasswordPage() {
  return (
    <>
      <Head>
        <title>Forgot Password - The Crafty Studio</title>
        <meta name="description" content="Reset your Crafty Studio account password" />
      </Head>
      <div className={styles.pageContainer}>
        <Navbar />
        <main className={styles.mainContent}>
          <ForgotPasswordForm />
        </main>
      </div>
    </>
  );
}
