"use client";

import { useState } from "react";
import { useAuthContext } from "@/context/AuthContext";

/**
 * Custom hook for authentication state and operations.
 * Placeholder for future authentication logic (e.g., NextAuth, Supabase, JWT, session).
 */
export function useAuth() {
  //changed this for useAuthContext to keep user data
  const {user, loading, setUser} = useAuthContext();
  const [loginloading, setLoginLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (email, password) => {
    setLoginLoading(true);
    setError(null);
    try {
      
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        
        body: JSON.stringify({
          email,
          password
        }),
      });

      console.log("Response:", response);

      const data = await response.json();

      //if authentication failed
      if(!response.ok){
        throw new Error(data.error || "Failed to log in");
      }

      //if auth successful
      setUser(data.user);

      return data.user;
    } catch (err) {
      setError(err.message || "Failed to log in");
      return null;
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
  };

  return {
    user,
    loading, // AuthProvider's session check loading
    loginloading, //Login request loading
    error,
    login,
    logout,
  };
}

