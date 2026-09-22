import { useAuthContext } from "./AuthContext";
import { useRouter } from "next/router";
import { useEffect } from "react";

const publicRoutes = [
    "/",
    "/login",
    "/register",
];

//This is to differentiate the public pages and private pages depending on user's authentication role
export default function AuthGuard({ children }){
    const { user, loading } = useAuthContext();
    const router = useRouter();

    //Allow public login page + other public pages
    const isPublicPage = publicRoutes.some((route) =>
        route === "/"
            ? router.pathname === "/"
            : router.pathname === route ||
              router.pathname.startsWith(`${route}`)
    );

    useEffect(() => {
        if(!router.isReady || loading ) return;

        //Public pages <- don't need authentication
        if (isPublicPage) return;

        //Redirect unathenticated users for protected pages
        if(!user){
            router.replace(
                `/login?next=${encodeURIComponent(router.asPath)}`
            );
        }
    }, [router.isReady, router.pathname, router.asPath, loading, user, isPublicPage]);

    //wait for session validation
    if(loading || !router.isReady){
        return <div>Loading...</div>;
    }

    //Allow public pages to render
    if(isPublicPage){
        return children;
    }

    //Prevent rendering protected content
    if (!user) {
        return null;
    }

    return children;
}