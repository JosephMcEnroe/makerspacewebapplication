import { query } from "@/lib/db";

export class classRepository {
    async findAllClass() {
        const { rows } = await query(
            `SELECT class_id, name_of_class, user_id, description,
                   class_date, max_capacity
            FROM "class"
            ORDER BY class_date
        `);
        return rows;
    }

    async findClass(classID) {
        const { rows } = await query(
            `SELECT class_id, name_of_class, user_id, description,
                   class_date, max_capacity
            FROM "class"
            WHERE class_id = $1
        `, [classID]);
        return rows[0] || null;
    }

    async createClass(classData) {
        const { rows } = await query(
            `INSERT INTO "class" (
                name_of_class,
                user_id,
                description,
                class_date,
                max_capacity
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING class_id, name_of_class, user_id, description,
                      class_date, max_capacity
        `, [
            classData.name_of_class,
            classData.user_id,
            classData.description,
            classData.class_date,
            classData.max_capacity
        ]);
        return rows[0];
    }
    async updateClass(classID, classData) {
        const { rows } = await query(
            `UPDATE "class"
             SET name_of_class = $2,
                 user_id = $3,
                 description = $4,
                 class_date = $5,
                 max_capacity = $6
             WHERE class_id = $1
             RETURNING class_id, name_of_class, user_id, description,
                       class_date, max_capacity
        `, [
            classID,
            classData.name_of_class,
            classData.user_id,
            classData.description,
            classData.class_date,
            classData.max_capacity
        ]);
        return rows[0] || null;
    }

    async deleteClass(classID) {
        const { rowCount } = await query(
            `DELETE FROM "class"
             WHERE class_id = $1
        `, [classID]);

        return rowCount > 0;
    }
}

export default classRepository;