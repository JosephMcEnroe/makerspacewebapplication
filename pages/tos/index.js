
import Head from "next/head";
import TermOfServiceForm from "@/components/TermOfServiceForm";

import styles from "@/components/TermOfServicePage.module.css";

export default function TOSPage() {
    return (
        <>
            <Head>
                <title>Terms of Service - Makerspace</title>
            </Head>
            <div className={styles.tosContainer}>
                <main className={styles.tosMain}>
                    <h2>Terms of Service</h2>
                    <p>
                        Please review the Terms of Service below.
                        Scroll to the bottom to accept.
                    </p>
                    <TermOfServiceForm />
                </main>
            </div>
        </>
    );
}
