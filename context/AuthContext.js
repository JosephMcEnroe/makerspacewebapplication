import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authCheckFailed, setAuthCheckFailed] = useState(false);

    useEffect(() => {
        async function checkAuth() {
            try{
                const response = await fetch("/api/auth/checkC", {
                    credentials: "include",
                    cache: "no-store",
                });

                const data = await response.json();

                if (response.ok && data.ok) {
                    setUser(data.user);
                    setAuthCheckFailed(false);
                } else if (response.status === 401) {
                    setUser(null);
                    setAuthCheckFailed(false);
                } else {
                    setUser(null);
                    setAuthCheckFailed(true);
                }
            } catch (error){
                console.error("Authentication check failed:", error);
                setUser(null);
                setAuthCheckFailed(true);
            } finally {
                setLoading(false);
            }
        }

        checkAuth();
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                authCheckFailed,
                setUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuthContext() {
    return useContext(AuthContext);
}