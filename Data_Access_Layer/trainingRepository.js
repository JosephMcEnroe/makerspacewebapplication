import { query } from "@/lib/db";

const COLUMNS = `t.training_id, t.user_id, t.equipment_key, t.status,
    t.completed_at, t.reviewed_at, t.reviewed_by`;

export class trainingRepository {
    //Every training record for one member (account page)
    async findByUser(userId) {
        const { rows } = await query(
            `SELECT ${COLUMNS}
             FROM "equipment_training" t
             WHERE t.user_id = $1`,
            [userId]
        );
        return rows;
    }

    //All training records with member names for the staff approval page
    async findAllWithMembers() {
        const { rows } = await query(
            `SELECT ${COLUMNS}, u.first_name, u.last_name, u.email,
                r.first_name AS reviewer_first_name, r.last_name AS reviewer_last_name
             FROM "equipment_training" t
             JOIN "users" u ON u.user_id = t.user_id
             LEFT JOIN "users" r ON r.user_id = t.reviewed_by
             ORDER BY t.completed_at DESC`
        );
        return rows;
    }

    //Member finished a training module. Creates a PENDING record, or resubmits
    //a DENIED one. Returns null if it's already pending or approved.
    async submit(userId, equipmentKey) {
        const { rows } = await query(
            `INSERT INTO "equipment_training" (user_id, equipment_key, status, completed_at)
             VALUES ($1, $2, 'PENDING', NOW())
             ON CONFLICT (user_id, equipment_key) DO UPDATE
                SET status = 'PENDING', completed_at = NOW(),
                    reviewed_at = NULL, reviewed_by = NULL
                WHERE "equipment_training".status = 'DENIED'
             RETURNING training_id, user_id, equipment_key, status, completed_at`,
            [userId, equipmentKey]
        );
        return rows[0] || null;
    }

    //Staff approves or denies a pending record. Returns null if it isn't pending.
    async review(trainingId, status, reviewerId) {
        const { rows } = await query(
            `UPDATE "equipment_training"
             SET status = $2, reviewed_at = NOW(), reviewed_by = $3
             WHERE training_id = $1 AND status = 'PENDING'
             RETURNING training_id, status, reviewed_at`,
            [trainingId, status, reviewerId]
        );
        return rows[0] || null;
    }
}

export default trainingRepository;
