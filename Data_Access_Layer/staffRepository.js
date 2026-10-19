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

    //Returns true if the user is staff (staff table or STAFF membership role)
    async isStaff(userId) {
        const { rows } = await query(
            `SELECT EXISTS (
                SELECT 1 FROM "staff" WHERE user_id = $1
             ) OR EXISTS (
                SELECT 1
                FROM "membership"
                WHERE user_id = $1
                  AND UPPER(TRIM(role_of_membership::TEXT)) = 'STAFF'
             ) AS is_staff`, //OR you can implement "role_of_membership = 'STAFF'::role_of_membership" for direct enum comparison
            [userId]
        );
        return rows[0]?.is_staff === true;
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