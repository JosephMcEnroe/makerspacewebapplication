import { query } from "@/lib/db";

export class StaffRepository {
    async findAllStaff() {
        const { rows } = await query(
            `SELECT user_id
             FROM "staff"
             ORDER BY user_id`
        );
        return rows;
    }

    async findByStaff(userId) {
        const { rows } = await query(
            `SELECT user_id
             FROM "staff"
             WHERE user_id = $1`,
            [userId]
        );
        return rows[0] || null;
    }

    async createStaff(userId) {
        const { rows } = await query(
            `INSERT INTO "staff" (user_id)
             VALUES ($1)
             RETURNING user_id`,
            [userId]
        );
        return rows[0];
    }

    async deleteStaff(userId) {
        const { rowCount } = await query(
            `DELETE FROM "staff"
             WHERE user_id = $1`,
            [userId]
        );
        return rowCount > 0;
    }
}

export default StaffRepository;