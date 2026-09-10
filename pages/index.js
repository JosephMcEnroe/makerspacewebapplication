import Head from "next/head";
import Navbar from "@/components/Navbar";
import LoginForm from "@/components/LoginForm";
import styles from "@/styles/Login.module.css";

export default function Home() {
  return (
    <>
      <Head>
        <title>The Crafty Studio - Makerspace</title>
        <meta name="description" content="Sign in to your Crafty Studio account" />
      </Head>
      <div className={styles.pageContainer}>
      </div>
    </>
  );
}

