import { useAuthContext } from "./AuthContext";
import { useRouter } from "next/router";
import { useEffect } from "react";

//This is to differentiate the public pages and private pages depending on user's authentication role
export default function AuthGuard({ children }){
    const { user, loading } = useAuthContext();
    const router = useRouter();

    //Allow public login page + other public pages
    const isLoginPage = router.pathname === "/login";

    useEffect(() => {
        if(!loading && !user && !isLoginPage){
            router.replace("/login");
        }
    }, [user, loading, isLoginPage, router]);

    //wait for session validation
    if(loading){
        return <div>Checking authentication...</div>;
    }

    //Prevent rendering protected content
    if (!user && !isLoginPage) {
        return null;
    }

    return children;
}