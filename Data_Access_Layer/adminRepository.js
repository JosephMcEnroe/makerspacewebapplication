import { query } from "@/lib/db";
export class adminRepository {
    //Search and list all Admin in database
    async findAllAdmin() {
        const { rows } = await query(
            `SELECT user_id
             FROM "admin"
             ORDER BY user_id`
        );
        return rows;
    }
    //Search specific admin using userID
    async findByUserIdAdmin(userId) {
        const { rows } = await query(
            `SELECT user_id
             FROM "admin"
             WHERE user_id = $1`,
            [userId]
        );
        return rows[0] || null;
    }
    //Create Admin
    async createAdmin(userId) {
        const { rows } = await query(
            `INSERT INTO "admin" (user_id)
             VALUES ($1)
             RETURNING user_id`,
            [userId]
        );
        //Show data after adding data into database
        return rows[0];
    }

    async deleteAdmin(userId) {
        const { rowCount } = await query(
            `DELETE FROM "admin"
             WHERE user_id = $1`,
            [userId]
        );
        //Return true if not 0
        return rowCount > 0;
    }
}
export default adminRepository;