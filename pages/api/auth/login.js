//npm install bcrypt.s (must otherwise cause error) to compare passwords later that have hash
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { serialize } from "cookie";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { isValidEmail, isValidLoginPassword, normalizeEmail } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { verifyCsrfToken } from "@/lib/csrf";

export default async function handler(req, res) {
    //Instantiate UserRepository
    const userQuery = new UserRepository();

    //debugging logs in console log
    console.log("=== LOGIN REQUEST ===");
    console.log("Method:", req.method);

    if (req.method !== "POST"){
        return res.status(405).json({
            ok: false,
            error: "Method not allowed",
        });
    }

    if (!verifyCsrfToken(req)) {
        return res.status(403).json({
            ok: false,
            error: "Invalid or missing CSRF token",
        });
    }

    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!allowed) {
        res.setHeader("Retry-After", retryAfterSeconds);
        return res.status(429).json({
            ok: false,
            error: "Too many login attempts. Please try again later.",
        });
    }

    try {

        const { email, password } = req.body;

        console.log("Email received from API:", JSON.stringify(email));
        console.log("Password received?", !!password);

        if (!email || !password){
            return res.status(400).json({
                ok: false,
                error: "Email and password are required",
            });
        }

        if (!isValidEmail(email) || !isValidLoginPassword(password)) {
            return res.status(400).json({
                ok: false,
                error: "Invalid email or password",
            });
        }

        console.log("Email type:", typeof email);

        const result = await userQuery.findEmailAuthentication(normalizeEmail(email));

        const user = result;
        console.log("User found?", !!user);

        if(!user){
            return res.status(401).json({
                ok: false,
                error: "Invalid email or password",
            });
        }

        //implement hashed password comparison here with bcrypt
        const pwordMatches = await bcrypt.compare(
            password,
            user.password
        );
        console.log("Password matches?", pwordMatches);

        //if the password is wrong
        if(!pwordMatches) {
            return res.status(401).json({
                ok: false,
                error: "invalid email or password",
            });
        }

        const sessionId = crypto.randomBytes(32).toString("hex");

        const isStored = await userQuery.insertCookie(sessionId, user.user_id);

        if(!(isStored == null)){
            console.log("WARNING - the session isn't stored: ", isStored);
            return res.status(401).json({
                ok: false,
                error: "Session cookie isn't stored",
            });
        }

        res.setHeader(
            "Set-Cookie",
            serialize("session_id", sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 1800, //30 minutes
            })
        );

        const member = await userQuery.findRoleById(user.user_id);
        console.log("Role found: ", member);

        return res.status(200).json({
            ok: true,

            user: {
                id: user.user_id ?? -1,
                status: member.status ?? "null",
                role: member.type_of_membership ?? ""
            },
        });
    } catch(error){
        console.error("Login error:", error);

        return res.status(500).json({
            ok: false,
            error: "Login failed",
        })
    }
}