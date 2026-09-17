import { query } from "@/lib/db";

export class roomRepository {
    async findAllRoom() {
        const { rows } = await query(
            `SELECT room_id, name, type, cost
            FROM "room"
        `);
        return rows;
    }

    async findRoom(roomID) {
        const { rows } = await query(
            `SELECT room_id, name, type, cost
            FROM "room"
            WHERE room_id = $1
        `, [roomID]);

        return rows[0] || null;
    }

    async createRoom(room) {
        const { rows } = await query(
            `INSERT INTO "room" (
                name,
                type,
                cost
            )
            VALUES ($1, $2, $3)
            RETURNING room_id, name, type, cost
        `, [
            room.name,
            room.type,
            room.cost
        ]);
        return rows[0];
    }
    async updateRoom(roomID, room) {
        const { rows } = await query(
            `UPDATE "room"
            SET name = $2,
                type = $3,
                cost = $4
            WHERE room_id = $1
            RETURNING room_id, name, type, cost
        `, [
            roomID,
            room.name,
            room.type,
            room.cost
        ]);

        return rows[0] || null;
    }

    async deleteRoom(roomID) {
        const { rowCount } = await query(
            `DELETE FROM "room"
            WHERE room_id = $1
        `, [roomID]);

        return rowCount > 0;
    }
}

export default roomRepository;