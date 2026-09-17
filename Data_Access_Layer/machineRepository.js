import { query } from "@/lib/db";

export class machineRepository {
    async findAllMachine() {
        const { rows } = await query(
            `SELECT machine_id, name, type, cost, status
            FROM "machine"
            `
        );
        return rows[0] || null;
    }

    async findMachine(machineID) {
        const { rows } = await query(
            `SELECT machine_id, name, type, cost, status
            FROM "machine"
            WHERE machine_id = $1
            `,
            [machineID]
        );
        return rows[0] || null;
    }

    async createMachine(machine) {
        const { rows } = await query(`
            INSERT INTO "machine" (
                name,
                type,
                cost,
                status
            )
            VALUES ($1, $2, $3, $4)
            RETURNING machine_id, name, type, cost, status
        `, [
            machine.name,
            machine.type,
            machine.cost,
            machine.status
        ]);
        return rows[0];
    }
    async updateMachine(machineID, machine) {
        const { rows } = await query(`
        UPDATE "machine"
        SET name = $2,
            type = $3,
            cost = $4,
            status = $5
        WHERE machine_id = $1
        RETURNING machine_id, name, type, cost, status
    `, [
            machineID,
            machine.name,
            machine.type,
            machine.cost,
            machine.status
        ]);
        return rows[0] || null;
    }

    async deleteMachine(machineID) {
        const { rowCount } = await query(`
        DELETE FROM "machine"
        WHERE machine_id = $1
    `, [machineID]);

        return rowCount > 0;
    }
}

export default machineRepository;