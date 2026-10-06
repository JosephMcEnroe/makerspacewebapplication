import { query } from "@/lib/db";

export class machineBookingRepository {
    async findAllMachineBooking() {
        const { rows } = await query(
            `SELECT booking_id, machine_id, start_date_time,
                end_date_time, user_id
         FROM "machine_booking"`
        );
        return rows;
    }

    async findUserBooking(userId) {
        const { rows } = await query(
            `SELECT
            mb.booking_id,
            mb.user_id,
            mb.machine_id,
            mb.start_date_time,
            mb.end_date_time,
            m.name AS machine_name,
            m.type AS machine_type,
            m.cost AS machine_cost,
            m.status AS machine_status
        FROM "machine_booking" mb
        JOIN "machine" m
            ON mb.machine_id = m.machine_id
        WHERE mb.user_id = $1
        ORDER BY mb.start_date_time DESC
    `,
            [userId]
        );

        return rows;
    }

    async createMachineBooking(booking) {
        const { rows } = await query(`
            INSERT INTO "machine_booking" (
                machine_id,
                start_date_time,
                end_date_time,
                user_id
            )
            VALUES ($1, $2, $3, $4)
            RETURNING booking_id, machine_id, start_date_time,
                      end_date_time, user_id
        `, [
            booking.machine_id,
            booking.start_date_time,
            booking.end_date_time,
            booking.user_id
        ]);
        return rows[0];
    }
}
export default machineBookingRepository;