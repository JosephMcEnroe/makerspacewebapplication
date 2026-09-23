import bcrypt from "bcryptjs";
import crypto from "crypto";
import { serialize } from "cookie";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";

export default async function handler(req, res) {
    const userQuery = new UserRepository();

    console.log("==== SIGNUP REQUEST ====");
    console.log("Method:", req.method);

    if (req.method !== "POST"){
        return res.status(405).json({
            ok: false,
            error: "Method not allowed",
        });
    }

    try{
        const { fName, lName, email, password } = req.body;

        console.log("First & Last names: ", (fName + " " + lName));
        console.log("Email received from API:", JSON.stringify(email));
        console.log("Password received?", !!password);

        const hashedPassword = await bcrypt.hash(password, 12); //12 = reasonable balance of security & performance, 14 for more computationally expensive & slower
        const sessionId = crypto.randomBytes(32).toString("hex");

        const user = {
            first_name: fName,
            last_name: lName,
            phone_number: null,
            email: email.toLowerCase(),
            password: hashedPassword,
            notes: null,
            rfid_id: null,
            last_check_in: null
        }

        /**
         * IMPORTANT REMINDER: How to update the frontend page to pop up a block to verify and then 
         * receive confirmation before we can add user to the database? 
         */

        const isAdded = await userQuery.createUser(user);

        if(!isAdded){
            console.log("The database has fail to add the new user");
        }

        const newUser = await userQuery.findEmailAuthentication(user.email);

        const isStored = await userQuery.insertCookie(sessionId, newUser.user_id);

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

        //Pause here until the userRepository queries is updated for createMember & createMembership
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
        console.log("Signup error: ", error);

        return res.status(500).json({
            ok: false,
            error: "Signup failed",
        })
    }
}