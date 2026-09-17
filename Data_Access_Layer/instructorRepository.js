import { query } from "@/lib/db";

export class InstructorRepository {
    async findAllInstructor() {
        const { rows } = await query(
            `SELECT user_id
             FROM "instructor"
             ORDER BY user_id`
        );
        return rows;
    }

    async findInstructorUser(userId) {
        const { rows } = await query(
            `SELECT user_id
             FROM "instructor"
             WHERE user_id = $1`,
            [userId]
        );
        return rows[0] || null;
        //if multiple memberships on one user account
        return rows;
    }

    async createInstructor(userId) {
        const { rows } = await query(
            `INSERT INTO "instructor" (user_id)
             VALUES ($1)
             RETURNING user_id`,
            [userId]
        );
        return rows[0];
    }

    async deleteInstructor(userId) {
        const { rowCount } = await query(
            `DELETE FROM "instructor"
             WHERE user_id = $1`,
            [userId]
        );
        return rowCount > 0;
    }
}

export default InstructorRepository;