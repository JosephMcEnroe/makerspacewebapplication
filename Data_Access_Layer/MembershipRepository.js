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
            `SELECT membership_id, user_id, role_of_membership, period_start_date, period_end_date, rfid_id, status, stripe_subscription_id, auto_renew
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
    //autoRenew should be TRUE for monthly subscriptions and FALSE for day passes.
    //A day pass clears any old subscription id, otherwise it isn't recognized as a day pass and never expires.
    async activateMembership(userId, periodStartDate, periodEndDate, stripeSubscriptionId = null, autoRenew = true) {
        const updated = await query(
            `UPDATE "membership"
             SET status = 'ACTIVE',
                 period_start_date = $2,
                 period_end_date = $3,
                 auto_renew = $5,
                 stripe_subscription_id = CASE WHEN $5 THEN COALESCE($4, stripe_subscription_id) ELSE $4 END
             WHERE user_id = $1
             RETURNING membership_id, user_id, status, period_start_date, period_end_date, stripe_subscription_id, auto_renew`,
            [userId, periodStartDate, periodEndDate, stripeSubscriptionId, autoRenew]
        );
        if (updated.rows[0]) return updated.rows[0];

        const inserted = await query(
            `INSERT INTO "membership" (user_id, role_of_membership, period_start_date, period_end_date, rfid_id, status, stripe_subscription_id, auto_renew)
             VALUES ($1, 'MEMBER', $2, $3, NULL, 'ACTIVE', $4, $5)
             RETURNING membership_id, user_id, status, period_start_date, period_end_date, stripe_subscription_id, auto_renew`,
            [userId, periodStartDate, periodEndDate, stripeSubscriptionId, autoRenew]
        );
        return inserted.rows[0] || null;
    }

    //Updates the auto_renew flag for the user's membership
    async updateAutoRenew(userId, autoRenew) {
        const { rows } = await query(
            `UPDATE "membership"
             SET auto_renew = $2
             WHERE user_id = $1
             RETURNING membership_id, user_id, auto_renew, status`,
            [userId, autoRenew]
        );
        return rows[0] || null;
    }

    //Marks the user's membership is inactive
    async deactivateMembership(userId) {
        const { rows } = await query(
            `UPDATE "membership"
             SET status = 'INACTIVE',
                 auto_renew = FALSE
             WHERE user_id = $1
             RETURNING membership_id, user_id, status, auto_renew`,
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