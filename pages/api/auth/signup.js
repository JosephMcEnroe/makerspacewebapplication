import bcrypt from "bcryptjs";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { membershipRepositry } from "@/Data_Access_Layer/MembershipRepository";
import { memberRepositry } from "@/Data_Access_Layer/memberRepository";
import { isValidEmail, isValidNewPassword, normalizeEmail, sanitizeName } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { verifyCsrfToken } from "@/lib/csrf";
import { sendVerificationEmail } from "@/lib/email";

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

    if (!verifyCsrfToken(req)) {
        return res.status(403).json({
            ok: false,
            error: "Invalid or missing CSRF token",
        });
    }

    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
    if (!allowed) {
        res.setHeader("Retry-After", retryAfterSeconds);
        return res.status(429).json({
            ok: false,
            error: "Too many signup attempts. Please try again later.",
        });
    }

    try{
        const { fName, lName, email, password } = req.body;

        console.log("First & Last names: ", (fName + " " + lName));
        console.log("Email received from API:", JSON.stringify(email));
        console.log("Password received?", !!password);

        const firstName = sanitizeName(fName);
        const lastName = sanitizeName(lName);

        if (!firstName || !lastName) {
            return res.status(400).json({
                ok: false,
                error: "First and last name may only contain letters, spaces, hyphens and apostrophes",
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                ok: false,
                error: "Please provide a valid email address",
            });
        }

        if (!isValidNewPassword(password)) {
            return res.status(400).json({
                ok: false,
                error: "Password must be between 8 and 128 characters",
            });
        }

        const normalizedEmail = normalizeEmail(email);

        //An unverified account with this email can be signed up over (typo'd or
        //someone else's address) - only verified accounts block a new signup
        const existing = await userQuery.findEmailAuthentication(normalizedEmail);
        if (existing?.email_verified) {
            return res.status(409).json({
                ok: false,
                error: "An account with that email already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12); //12 = reasonable balance of security & performance, 14 for more computationally expensive & slower

        const user = {
            first_name: firstName,
            last_name: lastName,
            phone_number: null,
            email: normalizedEmail,
            password: hashedPassword,
            notes: null,
            waiver_status: false
        }

        /**
         * For frontend
         * IMPORTANT REMINDER: How to update the frontend page to pop up a block to verify and then 
         * receive confirmation before we can add user to the database? 
         */

        let newUser;

        if (existing) {
            newUser = await userQuery.replaceUnverifiedUser(existing.user_id, user);

            //Verified between the lookup and the update
            if (!newUser) {
                return res.status(409).json({
                    ok: false,
                    error: "An account with that email already exists",
                });
            }
        } else {
            const isAdded = await userQuery.createUser(user);

            if(!isAdded){
                console.log("The database has fail to add the new user");
            }

            newUser = await userQuery.findEmailAuthentication(user.email);
        }

        const existingMp = await mpQuery.findUserMembership(newUser.user_id);

        //Pause here until the userRepository queries is updated for createMember & createMembership
        const membership = {
            user_id: newUser.user_id,
            role_of_membership: "MEMBER",
            period_start_date: '2026-09-29', //Hardcoded for now for login/signup to work - update to use DATE.NOW()
            period_end_date: '2026-12-01',
            rfid_id: null,
            status: "INACTIVE"
        }

        if (!existingMp) {
            const isNewmp = await mpQuery.createMembership(membership);

            if(!isNewmp){
                console.log("The database failed to add a new membership");
            }
        }

        // No session yet - the user signs in after clicking the link in this email.
        // If sending fails the account still exists; logging in re-sends the link.
        try {
            await sendVerificationEmail(req, {
                userId: newUser.user_id,
                email: newUser.email,
                firstName: newUser.first_name,
                passwordHash: newUser.password,
            });
        } catch (emailError) {
            console.error("Verification email error:", emailError);
        }

        // const member = {
        //     user_id: newUser.user_id,
        //     membership_id: newMp.membership_id,
        //     period_start_date: null,
        //     period_end_date: null,
        //     status: "Inactive",
        //     type_of_membership: "member",
        // }

        // const isNewmember = await memberQuery.createMember(member);

        // if(!isNewmember){
        //     console.log("The database failed to add a new member");
        // }

        // const newMember = await memberQuery.findByIdMember(member.user_id);


        //have a placeholder for waiver - additional for phone number, start/end date, & cost

        return res.status(200).json({
            ok: true,
            verificationRequired: true,
            email: newUser.email,
        });
    } catch(error){
        console.log("Signup error: ", error);

        // Postgres unique_violation - handles the race where two signups for
        // the same email land between the existence check and the insert.
        if (error?.code === "23505") {
            return res.status(409).json({
                ok: false,
                error: "An account with that email already exists",
            });
        }

        return res.status(500).json({
            ok: false,
            error: "Signup failed",
        })
    }
}