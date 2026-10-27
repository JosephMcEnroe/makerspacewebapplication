import { parse } from "cookie";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { formatYear } from "@/lib/format";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.removeHeader("ETag");

    try {
        const cookies = parse(req.headers.cookie || "");

        const sessionId = cookies.session_id;

        if (!sessionId) {
            return res.status(401).json({
                ok: false,
                user: null,
            });
        }

        const query = new UserRepository();

        // Staff/admin flags let shared pages show the staff navbar
        const user = await query.findStaffSessionByCookie(sessionId);

        if (!user) {
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
                role: user.role_of_membership,
                firstName: user.first_name,
                lastName: user.last_name,
                memberSince: formatYear(user.period_start_date),
                isStaff: user.is_staff,
                isAdmin: user.is_admin,
            },
        });
    } catch (error) {
        console.error("Auth check error:", error);

        return res.status(500).json({
            ok: false,
            user: null,
            error: "Authentication check failed",
        });
    }
}