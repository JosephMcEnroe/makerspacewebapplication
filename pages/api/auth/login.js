//install bcrypt.s to compare passwords later that have hash
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

export default async function handler(req, res) {
    if (req.method !== "POST"){
        return res.status(405).json({
            ok: false,
            error: "Method not allowed",
        });
    }

    try {

        const { email, password } = req.body;

        if (!email || !password){
            return res.status(400).json({
                ok: false,
                error: "Email and password are required",
            });
        }

        const result = await query(
            `
                SELECT user_id, email, password, type_of_membership
            `,
            [email]    
        );

        const user = result.rows[0];

        if(!user){
            return res.status(401).json({
                ok: false,
                error: "Invalid email or password",
            });
        }

        //implement hashed password comparison here with bcrypt

        //if the password is wrong
        

        return res.status(200).json({
            ok: true,

            user: {
                id: user.user_id,
                email: user.email,
                role: user.type_of_membership
            },
        });
    } catch(error){
        console.error("Login error:", error);

        return res.status(500).json({
            ok: false,
            error: "Something went wrong during login",
        })
    }
}