import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function ResetPasswordForm() {
    const router = useRouter();
    const { resetPassword, loginloading } = useAuth();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const token =
        typeof router.query.token === "string"
            ? router.query.token
            : "";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");
        if (!token) {
            setError("Invalid or missing password reset link.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        try {
            const data = await resetPassword(token, password);
            setMessage(data.message || "Password successfully reset.");
            setPassword("");
            setConfirmPassword("");

            await router.push("/login?passwordReset=success");
        } catch (err) {
            setError(err.message || "Unable to reset password.");
        }
    };
    return (
        <div>
            <h2>Reset Your Password</h2>
            <p>Enter your new password below.</p>

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="password">New Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        maxLength={72}
                        required
                        disabled={loginloading || !router.isReady}
                    />
                </div>
                <div>
                    <label htmlFor="confirmPassword">
                        Confirm New Password
                    </label>
                    <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={8}
                        maxLength={72}
                        required
                        disabled={loginloading || !router.isReady}
                    />
                </div>
                {message && <p role="status">{message}</p>}
                {error && <p role="alert">{error}</p>}
                <button
                    type="submit"
                    disabled={loginloading || !router.isReady || !token || !!message}
                >
                    {loginloading ? "Resetting..." : "Reset Password"}
                </button>
            </form>
            <p>
                <Link href="/login">Return to Login</Link>
            </p>
        </div>
    );
}