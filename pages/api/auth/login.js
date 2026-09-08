//npm install bcrypt.s (must otherwise cause error) to compare passwords later that have hash
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

export default async function handler(req, res) {
    //debugging logs in console log
    console.log("=== LOGIN REQUEST ===");
    console.log("Method:", req.method);

    if (req.method !== "POST"){
        return res.status(405).json({
            ok: false,
            error: "Method not allowed",
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

        console.log("Email type:", typeof email);

        const result = await query(
            `
                SELECT user_id, email, password
                FROM users
                WHERE email = $1
            `,
            [email]    
        );
        console.log("Database result:", result.rows);

        const user = result.rows[0];
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

        return res.status(200).json({
            ok: true,

            user: {
                id: user.user_id,
                email: user.email,
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