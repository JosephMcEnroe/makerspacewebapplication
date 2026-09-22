import { query } from "@/lib/db";

export class memberRepositry {
    async findAllMember() {
        const { rows } = await query(
            `SELECT user_id, membership_id, period_start_date,
                period_end_date, status, type_of_membership
         FROM "member"
         ORDER BY user_id`
        );
        return rows;

    }
    async findByIdMember(userId) {
        const { rows } = await query(
            `SELECT user_id, membership_id, period_start_date,
                period_end_date, status, type_of_membership
         FROM "member"
         WHERE user_id = $1`,
            [userId]
        );
        return rows[0] || null;
    }

    async createMember(member) {
        const { rows } = await query(
            `INSERT INTO "member" (
            user_id,
            membership_id,
            period_start_date,
            period_end_date,
            status,
            type_of_membership
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING user_id, membership_id, period_start_date,
                  period_end_date, status, type_of_membership
        `, [
            member.user_id,
            member.membership_id,
            member.period_start_date,
            member.period_end_date,
            member.status,
            member.type_of_membership
        ]);
        return rows[0];
    }

    async updateMember(userId, member) {
        const { rows } = await query(
            `UPDATE "member"
        SET membership_id = $2,
            period_start_date = $3,
            period_end_date = $4,
            status = $5,
            type_of_membership = $6
        WHERE user_id = $1
        RETURNING user_id, membership_id, period_start_date,
                  period_end_date, status, type_of_membership
        `, [
            userId,
            member.membership_id,
            member.period_start_date,
            member.period_end_date,
            member.status,
            member.type_of_membership
        ]);
        return rows[0] || null;
    }
    async deleteMember(userId) {
        const { rows } = await query(
            `DELETE FROM "member"
        WHERE user_id = $1
        RETURNING user_id, membership_id, period_start_date,
                  period_end_date, status, type_of_membership
        `, [userId]);
        return rows[0] || null;
    }

    //Individual update instead of whole update method at once as shown in updateMember(userId, member)
    async updateMemberStatus(userId, status) {
        const { rows } = await query(
            `UPDATE "member"
        SET status = $2
        WHERE user_id = $1;
        RETURNING user_id, membership_id, period_start_date,
                  period_end_date, status, type_of_membership
        `, [userId, status]);
        return rows[0] || null;
    }
}