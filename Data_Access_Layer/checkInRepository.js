import { query } from "@/lib/db";

export class checkInRepository {
    //DSEC = starting from latest date to past date
    async findAllCheckInUser() {
        const { rows } = await query(
            `SELECT user_id, datetime
         FROM "check_in"
         ORDER BY datetime DESC`
        );
        return rows;
    }

    async findCheckInUserID(userId) {
        const { rows } = await query(
            `SELECT user_id, datetime
         FROM "check_in"
         WHERE user_id = $1
         ORDER BY datetime DESC`,
            [userId]
        );
        return rows[0] || null;
    }

    async createCheckIn(userId, datetime) {
        const { rows } = await query(
        `INSERT INTO "check_in" (
            user_id,
            datetime
        )
        VALUES ($1, $2)
        RETURNING user_id, datetime
        `, [
            userId,
            datetime
        ]);
        return rows[0];
    }
}
export default checkInRepository;