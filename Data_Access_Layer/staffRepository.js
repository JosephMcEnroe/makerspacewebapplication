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
                  AND UPPER(TRIM(role_of_membership::text)) = 'STAFF'
             ) AS is_staff`,
            [userId]
        );
        return rows[0]?.is_staff === true;
    }

    //Live counts for the staff dashboard stat cards
    async getDashboardStats() {
        const { rows } = await query(
            `SELECT
                (SELECT COUNT(*) FROM "room_reservation"
                  WHERE end_date >= NOW()
                    AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%'))
              + (SELECT COUNT(*) FROM "machine_booking"
                  WHERE end_date_time >= NOW()) AS active_reservations,
                (SELECT COUNT(*) FROM "membership"
                  WHERE status = 'ACTIVE') AS active_members,
                (SELECT COUNT(*) FROM "class"
                  WHERE class_date >= NOW()) AS upcoming_classes`
        );
        const stats = rows[0];
        return {
            activeReservations: Number(stats.active_reservations),
            activeMembers: Number(stats.active_members),
            upcomingClasses: Number(stats.upcoming_classes),
        };
    }

    //Every reservation a user holds (rooms, equipment, classes) for staff views
    async findUserReservations(userId) {
        const [rooms, machines, classes] = await Promise.all([
            query(
                `SELECT rr.reservation_id AS id, r.name, rr.start_date AS start_at,
                    rr.end_date AS end_at, rr.status
                 FROM "room_reservation" rr
                 LEFT JOIN "room" r ON r.room_id = rr.room_id
                 WHERE rr.user_id = $1
                 ORDER BY rr.start_date DESC`,
                [userId]
            ),
            query(
                `SELECT b.booking_id AS id, m.name, b.start_date_time AS start_at,
                    b.end_date_time AS end_at, NULL AS status
                 FROM "machine_booking" b
                 LEFT JOIN "machine" m ON m.machine_id = b.machine_id
                 WHERE b.user_id = $1
                 ORDER BY b.start_date_time DESC`,
                [userId]
            ),
            query(
                `SELECT c.class_id AS id, c.name_of_class AS name, c.class_date AS start_at,
                    c.class_date AS end_at, NULL AS status
                 FROM "class_enrollment" e
                 JOIN "class" c ON c.class_id = e.class_id
                 WHERE e.user_id = $1
                 ORDER BY c.class_date DESC`,
                [userId]
            ).catch((error) => {
                // class_enrollment is created lazily on first class booking
                if (error.code === "42P01") return { rows: [] };
                throw error;
            }),
        ]);
        return [
            ...rooms.rows.map((row) => ({ ...row, type: "room" })),
            ...machines.rows.map((row) => ({ ...row, type: "equipment" })),
            ...classes.rows.map((row) => ({ ...row, type: "class" })),
        ];
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