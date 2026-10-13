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

    //Returns true if the user is an active member
    async isActiveMember(userId) {
        const { rows } = await query(
            `SELECT EXISTS (
                SELECT 1
                FROM "membership"
                WHERE user_id = $1
                  AND UPPER(TRIM(status)) = 'ACTIVE'
             ) AS is_member`,
            [userId]
        );
        return rows[0]?.is_member === true;
    }

    //Marks the user's membership ACTIVE for the given period (used by the Stripe webhook).
    //Creates the membership row if the user somehow doesn't have one yet.
    async activateMembership(userId, periodStartDate, periodEndDate) {
        const updated = await query(
            `UPDATE "membership"
             SET status = 'ACTIVE',
                 period_start_date = $2,
                 period_end_date = $3
             WHERE user_id = $1
             RETURNING membership_id, user_id, status, period_start_date, period_end_date`,
            [userId, periodStartDate, periodEndDate]
        );
        if (updated.rows[0]) return updated.rows[0];

        const inserted = await query(
            `INSERT INTO "membership" (user_id, role_of_membership, period_start_date, period_end_date, rfid_id, status)
             VALUES ($1, 'MEMBER', $2, $3, NULL, 'ACTIVE')
             RETURNING membership_id, user_id, status, period_start_date, period_end_date`,
            [userId, periodStartDate, periodEndDate]
        );
        return inserted.rows[0] || null;
    }

    //Marks the user's membership is inactive
    async deactivateMembership(userId) {
        const { rows } = await query(
            `UPDATE "membership"
             SET status = 'INACTIVE'
             WHERE user_id = $1
             RETURNING membership_id, user_id, status`,
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