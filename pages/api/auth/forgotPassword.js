import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { PasswordResetRepository } from "@/Data_Access_Layer/PasswordResetRepository";
import { verifyCsrfToken } from "@/lib/csrf";
import {createPasswordResetToken, hashPasswordResetToken,} from "@/lib/passwordResetToken";
import { sendPasswordResetEmail } from "@/lib/email";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            ok: false,
            error: "Method not allowed",
        });
    }
    if (!verifyCsrfToken(req)) {
    return res.status(403).json({
        ok: false,
        error: "Invalid CSRF token.",
    });
}
    const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();

    if (!email || email.length > 254) {
        return res.status(400).json({
            ok: false,
            error: "A valid email is required.",
        });
    }
    try {
        const userQuery = new UserRepository();
        const resetQuery = new PasswordResetRepository();
        const existing =
            await userQuery.findEmailAuthentication(email);
        // Generic response prevents account enumeration.
        const genericMessage =
            "If your account exists, a recovery link will be sent.";
        if (!existing || !existing.email_verified) {
            return res.status(200).json({
                ok: true,
                message: genericMessage,
            });
        }
        const token = createPasswordResetToken();
        const tokenHash = hashPasswordResetToken(token);
        // Invalidate previous reset links.
        await resetQuery.invalidateUserTokens(existing.user_id);
        // Save the new token hash.
        await resetQuery.createResetToken(
            existing.user_id,
            tokenHash
        );
        try {
            //send email
            await sendPasswordResetEmail(req, {
                email: existing.email,
                firstName: existing.first_name,
                token,
            });
        } catch (emailError) {
            await resetQuery.invalidateUserTokens(existing.user_id);
            throw emailError;
        }
        return res.status(200).json({
            ok: true,
            message: genericMessage,
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json({
            ok: false,
            error: "Unable to process your request.",
        });
    }
}