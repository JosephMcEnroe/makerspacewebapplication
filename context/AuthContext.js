import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkAuth() {
            try{
                const response = await fetch("/api/auth/checkC");

                const data = await response.json();

                if(data.ok){
                    setUser(data.user);
                }
            } catch (error){
                console.error("Authetication check failed:", error);
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