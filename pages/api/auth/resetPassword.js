import bcrypt from "bcrypt";
import { verifyCsrfToken } from "@/lib/csrf";
import { PasswordResetRepository } from "@/Data_Access_Layer/PasswordResetRepository";
import { hashPasswordResetToken } from "@/lib/passwordResetToken";

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
    const { token, newPassword } = req.body || {};
    if (
        typeof token !== "string" ||
        typeof newPassword !== "string" ||
        !token ||
        !newPassword
    ) {
        return res.status(400).json({
            ok: false,
            error: "Token and new password are required.",
        });
    }
    if (!/^[a-f0-9]{64}$/i.test(token)) {
        return res.status(400).json({
            ok: false,
            error: "Invalid or expired reset link.",
        });
    }
    if (
        newPassword.length < 8 ||
        Buffer.byteLength(newPassword, "utf8") > 72
    ) {
        return res.status(400).json({
            ok: false,
            error: "Password must contain at least 8 characters and must not exceed 72 UTF-8 bytes.",
        });
    }
    try {
        const resetQuery = new PasswordResetRepository();
        // Hash the original reset token for database lookup.
        const tokenHash = hashPasswordResetToken(token);
        // Hash the new password with bcrypt.
        const passwordHash = await bcrypt.hash(newPassword, 12);
        const success = await resetQuery.resetPassword(
            tokenHash,
            passwordHash
        );
        if (!success) {
            return res.status(400).json({
                ok: false,
                error: "Reset link is invalid, expired, or already used.",
            });
        }
        return res.status(200).json({
            ok: true,
            message: "Your password has been reset successfully.",
        });
    } catch (error) {
        console.error("Reset password error:", error);

        return res.status(500).json({
            ok: false,
            error: "Unable to reset your password.",
        });
    }
}
