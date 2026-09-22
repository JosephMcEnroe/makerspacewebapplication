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

  //The AuthContext already have the session authentication process, this function is there to manually authenticate the cookie in some testing areas. Delete this when it become obselete.
  const sessionCheck = async () => {
    
    try{
      const response = await fetch("api/auth/checkC", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      // If the session is invalid or expired
      if(!response.ok || !data.ok){
        setUser(null);
        return null;
      }

      // If the session is valid
      setUser(data.user);

      return data.user;
    } catch(err){
      setError(err.message || "Session check failed");
      setUser(null);
      return null;
    }
  }

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
    try{
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if(!response.ok){
        throw new Error(data.error || "Failed to log out");
      }

      //if logout successful
      setUser(null);

      return true;
    } catch(err){
      setError(err.message || "Failed to log out");
      return false;
    }
  };

  return {
    user,
    loading, // AuthProvider's session check loading or in general
    loginloading, //Login request loading
    error,
    sessionCheck,
    login,
    logout,
  };
}

