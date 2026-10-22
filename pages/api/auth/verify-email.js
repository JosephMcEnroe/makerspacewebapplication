import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { passwordFingerprint, readVerificationToken } from "@/lib/verificationToken";
import { sendWelcomeEmail } from "@/lib/email";

// Target of the link in the verification email. Marks the account verified,
// sends the welcome email the first time, then sends the user to /login.
export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({
            ok: false,
            error: "Method not allowed",
        });
    }

    const tokenData = readVerificationToken(req.query.token);

    if (!tokenData) {
        return res.redirect(302, "/login?verified=invalid");
    }

    try {
        const userQuery = new UserRepository();
        const existing = await userQuery.findEmailAuthentication(tokenData.email);

        if (!existing || String(existing.user_id) !== String(tokenData.userId)) {
            return res.redirect(302, "/login?verified=invalid");
        }

        //Link was already used
        if (existing.email_verified) {
            return res.redirect(302, "/login?verified=1");
        }

        //Someone signed up again over this unverified account - only the newest link works
        if (passwordFingerprint(existing.password) !== tokenData.pwd) {
            return res.redirect(302, "/login?verified=invalid");
        }

        const verifiedUser = await userQuery.markEmailVerified(tokenData.userId, tokenData.email);

        if (verifiedUser) {
            try {
                await sendWelcomeEmail(req, {
                    email: verifiedUser.email,
                    firstName: verifiedUser.first_name,
                });
            } catch (emailError) {
                console.error("Welcome email error:", emailError);
            }
        }

        return res.redirect(302, "/login?verified=1");
    } catch (error) {
        console.error("Verify email error:", error);
        return res.redirect(302, "/login?verified=invalid");
    }
}
