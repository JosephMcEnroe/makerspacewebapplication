import Head from "next/head";
import Navbar from "@/components/Navbar";
import RegisterForm from "@/components/RegisterForm";
import styles from "@/styles/Login.module.css";

export default function RegisterPage() {
  return (
    <>
      <Head>
        <title>Create Account - The Crafty Studio</title>
        <meta name="description" content="Create your Crafty Studio account" />
      </Head>
      <div className={styles.pageContainer}>
        <Navbar />
        <main className={styles.mainContent}>
          <RegisterForm />
        </main>
      </div>
    </>
  );
}

