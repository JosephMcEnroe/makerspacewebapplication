import Head from "next/head";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
    return (
        <>
            <Head>
                <title>Reset Password - The Crafty Studio</title>
            </Head>

            <ResetPasswordForm />
        </>
    );
}