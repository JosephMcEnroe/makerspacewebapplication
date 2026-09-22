import { parse } from "cookie";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";

export default async function handler(req, res) {
    try {
        const cookies = parse(req.headers.cookie || "");

        const sessionId = cookies.session_id;

        if(!sessionId){
            return res.status(401).json({
                ok: false,
                user: null,
            });
        }

        const query = new UserRepository();

        const user = await query.findByCookie(sessionId);

        if(!user){
            return res.status(401).json({
                ok: false,
                user: null,
            });
        }

        return res.status(200).json({
            ok: true,
            user: {
                id: user.user_id,
                status: user.status,
                role: user.type_of_membership,
            },
        });
    } catch (error) {
        console.error("Auth check error:", error);

        return res.status(500).json({
            ok: false,
            error: "Authentication check failed",
        });
    }
}