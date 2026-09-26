"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/router";
import Link from "next/link";
import styles from "./LoginForm.module.css";

function redirectForRole(router, role) {
  if (role === "admin") {
    router.push("/admin");
  } else if (role === "staff") {
    router.push("/staff");
  } else {
    router.push("/dashboard");
  }
}

export default function LoginForm() {
  const router = useRouter();

  //store the user inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const {
    user,
    login,
    loginloading,
    error,
  } = useAuth();

  useEffect(() => {
    if (user) {
      redirectForRole(router, user.role);
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    //calling the login from useAuth
    const user = await login(email, password);

    //login() returns null on failure (error is already set by useAuth)
    if (!user) {
      return;
    }

    //Where is the page for instructor/student? Is what the member page for?
    redirectForRole(router, user.role);
  };

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>WELCOME BACK</h1>
      <p className={styles.subtitle}>Sign in to your Crafty Studio account</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>
            Email Address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="your.email@example.com"
            className={styles.input}
            autoComplete="email"

            value={email}

            onChange={(e) => setEmail(e.target.value)}

            maxLength={254}

            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            placeholder="Enter your password"
            className={styles.input}
            autoComplete="current-password"

            value={password}

            onChange={(e) => setPassword(e.target.value)}

            maxLength={128}

            required
          />
        </div>

        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}

        <div className={styles.optionsRow}>
          <label className={styles.rememberMe}>
            <input type="checkbox" name="rememberMe" className={styles.checkbox} />
            <span>Remember me</span>
          </label>

          <Link href="/forgot-password" className={styles.forgotPassword}>
            Forgot password?
          </Link>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loginloading}>
          {loginloading ? "Signing In..." : "Sign In"}
        </button>

        <div className={styles.divider}>
          <span className={styles.dividerText}>OR</span>
        </div>

        <Link href="/register" className={styles.createAccountBtn}>
          Create New Account
        </Link>
      </form>
    </div>
  );
}

