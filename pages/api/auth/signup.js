import bcrypt from "bcryptjs";
import crypto from "crypto";
import { serialize } from "cookie";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { membershipRepositry } from "@/Data_Access_Layer/MembershipRepository";
import { memberRepositry } from "@/Data_Access_Layer/memberRepository";

export default async function handler(req, res) {
    const userQuery = new UserRepository();
    const mpQuery = new membershipRepositry();
    const memberQuery = new memberRepositry();

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
         * For frontend
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
        const membership = {
            user_id: newUser.user_id,
            cost: 0.0 //hardcoded for now? New member hasn't pay anthing, correct?
        }

        const isNewmp = await mpQuery.createMembership(membership);

        if(!isNewmp){
            console.log("The database failed to add a new membership");
        }

        const newMp = await mpQuery.findUserMembership(newUser.user_id);

        const member = {
            user_id: newUser.user_id,
            membership_id: newMp.membership_id,
            period_start_date: null,
            period_end_date: null,
            status: "Inactive",
            type_of_membership: "member",
        }

        const isNewmember = await memberQuery.createMember(member);

        if(!isNewmember){
            console.log("The database failed to add a new member");
        }

        const newMember = await memberQuery.findByIdMember(member.user_id);


        //have a placeholder for waiver - additional for phone number, start/end date, & cost

        return res.status(200).json({
            ok: true,

            //Update this and the one in login file for more data property - right now this is lazy user data
            user: {
                id: user.user_id ?? -1,
                status: newMember.status ?? "null",
                role: newMember.type_of_membership ?? ""
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