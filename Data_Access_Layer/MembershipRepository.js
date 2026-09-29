import { query } from "@/lib/db";

export class membershipRepositry {
    async findAllMembership() {
        const { rows } = await query(
            `SELECT membership_id, user_id, role_of_membership, period_start_date, period_end_date, rfid_id, status
             FROM "membership"
             ORDER BY membership_id`
        );
        return rows;
    }

    async findUserMembership(userId) {
        const { rows } = await query(
            `SELECT membership_id, user_id, role_of_membership, period_start_date, period_end_date, rfid_id, status
             FROM "membership"
             WHERE user_id = $1`,
            [userId]
        );
        return rows[0] || null;
    }

    async createMembership(membership) {
        const { rows } = await query(
            `INSERT INTO "membership" (
                user_id,
                role_of_membership,
                period_start_date,
                period_end_date,
                rfid_id,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING membership_id, user_id, role_of_membership, period_start_date, period_end_date, rfid_id, status`,
            [
                membership.user_id,
                membership.role_of_membership,
                membership.period_start_date,
                membership.period_end_date,
                membership.rfid_id,
                membership.status
            ]
        );
        return rows[0];
    }

    async updateMembership(membershipId, membership) {
        const { rows } = await query(
            `UPDATE "membership"
             SET user_id = $2,
                 role_of_membership = $3,
                 period_start_date = $4,
                 period_end_date = $5,
                 rfid_id = $6,
                 status = $7
             WHERE membership_id = $1
             RETURNING membership_id, user_id, cost`,
            [
                membershipId,
                membership.user_id,
                membership.role_of_membership,
                membership.period_start_date,
                membership.period_end_date,
                membership.rfid_id,
                membership.status
            ]
        );
        return rows[0] || null;
    }

    async deleteMembership(membershipId) {
        const { rowCount } = await query(
            `DELETE FROM "membership"
             WHERE membership_id = $1`,
            [membershipId]
        );
        return rowCount > 0;
    }
}
export default membershipRepositry;