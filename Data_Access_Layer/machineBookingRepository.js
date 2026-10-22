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
            `SELECT b.user_id, b.booking_id, b.machine_id, b.start_date_time,
                b.end_date_time, m.name AS machine_name
         FROM "machine_booking" b
         LEFT JOIN "machine" m ON m.machine_id = b.machine_id
         WHERE b.user_id = $1
         ORDER BY b.start_date_time DESC`,
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