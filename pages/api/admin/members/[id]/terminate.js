import { bannedRepository } from "@/Data_Access_Layer/bannedRepository";
import { requireStaffApi } from "@/lib/staffAuth";
import { verifyCsrfToken } from "@/lib/csrf";

export default async function handler(req, res) {

    // Only allow POST requests
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({
            error: "Method not allowed."
        });
    }

    //Verify CSRF token
    if(!verifyCsrfToken(req)){
        return res.status(403).json({
            error: "Invalid or missing CSRF token.",
        });
    }

    //Verify Authentication
    const session = await requireStaffApi(req, res);
    if(!session) return;

    //Admin-only authorization
    if(!session.isAdmin) {
        return res.status(403).json({
            error: "Only adminstrators can terminate accounts."
        });
    }

    //Validate user ID
    const userId = Number(req.query.id);

    if(!Number.isInteger(userId) || userId < 1) {
        return res.status(400).json({
            error: "Invalid user ID."
        });
    }

    //Prevent self-termination
    if (userId === session.user.user_id) {
        return res.status(400).json({
            error: "You cannot terminate your own account..."
        });
    }

    try {
        const reason = req.body?.reason?.trim() || 
        "Account terminated by administrator.";

        const result = await new bannedRepository().terminatedUser(
            userId,
            reason
        );

        if(!result){
            return res.status(404).json({
                error: "User not found."
            });
        }

        //Placeholder if user hasn't already been banned
        // if(result.alreadyBanned){
        //     return res.status(409).json({
        //         error: "This user is already banned."
        //     });
        // }

        return res.status(200).json({
            message: "Account successfully terminated."
        });
    } catch (error) {
        console.error("Termination error: ", error);

        return res.status(500).json({
            error: "Unable to terminate account. Please try again."
        });
    }
}