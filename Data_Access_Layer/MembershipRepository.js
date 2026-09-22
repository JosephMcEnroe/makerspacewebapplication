import { query } from "@/lib/db";

export class membershipRepositry {
    async findAllMembership() {
        const { rows } = await query(
            `SELECT membership_id, user_id, cost
             FROM "membership"
             ORDER BY membership_id`
        );
        return rows;
    }

    async findUserMembership(userId) {
        const { rows } = await query(
            `SELECT membership_id, user_id, cost
             FROM "membership"
             WHERE user_id = $1`,
            [userId]
        );
        return rows;
    }

    async createMembership(membership) {
        const { rows } = await query(
            `INSERT INTO "membership" (
                user_id,
                cost
            )
            VALUES ($1, $2)
            RETURNING membership_id, user_id, cost`,
            [
                membership.user_id,
                membership.cost
            ]
        );
        return rows[0];
    }

    async updateMembership(membershipId, membership) {
        const { rows } = await query(
            `UPDATE "membership"
             SET user_id = $2,
                 cost = $3
             WHERE membership_id = $1
             RETURNING membership_id, user_id, cost`,
            [
                membershipId,
                membership.user_id,
                membership.cost
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