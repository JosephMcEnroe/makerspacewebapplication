import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { serialize } from "cookie";

export default async function handler(req, res){
    const logoutQuery = new UserRepository();

    if (req.method !== "POST"){
        return res.status(405).json({
            ok: false,
            error: "Method not allowed",
        });
    }

    try{
        const sessionToken = req.cookies.session_id; //req.cookies.SAME_COOKIE_NAME <- I was struggling of why I was getting null cookie, but it was because I used the wrong cookie name

        if(!sessionToken){
            return res.status(401).json({
                error: "Session cookie not found",
            });
        }

        const isRemove = await logoutQuery.deleteCookie(sessionToken);

        if(!isRemove){
            console.log("No matching session found in database");
        }

        console.log("Session deleted:", !!isRemove);

        res.setHeader(
            "Set-Cookie",
            serialize("session_id", "", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                expires: new Date(0),
            })
        );

        return res.status(200).json({
            ok: true,
            success: "Logout succeed"
        })

    } catch(error){
        console.log("Logout error: ", error);

        return res.status(500).json({
            ok: false,
            error: "logout failed",
        })
    }
}