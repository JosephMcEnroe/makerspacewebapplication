import { query } from "@/lib/db";

export class roomReservationRepository {
    async findAllRoomReservation() {
        const { rows } = await query(
            `SELECT reservation_id, user_id, room_id,
                   start_date, end_date, status, date
            FROM "room_reservation"
        `);
        return rows;
    }

    async findRoomReservation(reservationID) {
        const { rows } = await query(
            `SELECT reservation_id, user_id, room_id,
                   start_date, end_date, status, date
            FROM "room_reservation"
            WHERE reservation_id = $1
        `, [reservationID]);

        return rows[0] || null;
    }

    async createRoomReservation(reservation) {
        const { rows } = await query(
            `INSERT INTO "room_reservation" (
                user_id,
                room_id,
                start_date,
                end_date,
                status,
                date
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING reservation_id, user_id, room_id,
                      start_date, end_date, status, date
        `, [
            reservation.user_id,
            reservation.room_id,
            reservation.start_date,
            reservation.end_date,
            reservation.status,
            reservation.date
        ]);
        return rows[0];
    }
    async updateRoomReservation(reservationID, reservation) {
        const { rows } = await query(
            `UPDATE "room_reservation"
             SET user_id = $2,
                 room_id = $3,
                 start_date = $4,
                 end_date = $5,
                 status = $6,
                 date = $7
             WHERE reservation_id = $1
             RETURNING reservation_id, user_id, room_id,
                       start_date, end_date, status, date`,
            [
                reservationID,
                reservation.user_id,
                reservation.room_id,
                reservation.start_date,
                reservation.end_date,
                reservation.status,
                reservation.date
            ]
        );

        return rows[0] || null;
    }

    async deleteRoomReservation(reservationID) {
        const { rowCount } = await query(
            `DELETE FROM "room_reservation"
             WHERE reservation_id = $1`,
            [reservationID]
        );

        return rowCount > 0;
    }
}

export default roomReservationRepository;