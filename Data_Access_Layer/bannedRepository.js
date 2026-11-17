import { query, getPool } from "@/lib/db";

export class bannedRepository {
    async terminatedUser(userId, reason) {
        const client = await getPool().connect();

        try {
            await client.query("BEGIN");

            //Retrieve user
            const { rows } = await client.query(`
                SELECT user_id, email
                FROM users
                WHERE user_id = $1
                FOR UPDATE
                `, [userId]);

            const user = rows[0];

            if(!user){
                await client.query("ROLLBACK");
                return null;
            }

            //Insert ban history
            await client.query(`
                INSERT INTO banned (
                    user_id,
                    email,
                    reason,
                    banned_date
                )
                VALUES ($1, $2, $3, CURRENT_DATE)
                `, [user.user_id, user.email, reason]);

            //Remove existing sessions
            await client.query(`
                DELETE FROM sessions
                WHERE user_id = $1
                `,[userId]);

            //Add UPDATE membership table to make the user's status to inactive?

            await client.query("COMMIT");

            return user;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    async isUserBanned(userId) {
        const { rows } = await query (`
            SELECT EXISTS (
                SELECT 1
                FROM banned
                WHERE user_id = $1
            ) AS is_banned
            `, [userId]);

        return rows[0].is_banned;
    }
}
export default bannedRepository;