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
            `SELECT user_id, booking_id, machine_id, start_date_time,
                end_date_time
         FROM "machine_booking"
         WHERE user_id = $1
         ORDER BY start_date_time DESC`,
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