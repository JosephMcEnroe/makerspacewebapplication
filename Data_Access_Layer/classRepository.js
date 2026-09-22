import { query } from "@/lib/db";

export class classRepository {
    async findAllClass() {
        const { rows } = await query(
            `SELECT class_id, name_of_class, user_id, description,
                   class_date, class_time, max_capacity
            FROM "class"
        `);
        return rows[0] || null;
    }

    async findClass(classID) {
        const { rows } = await query(
            `SELECT class_id, name_of_class, user_id, description,
                   class_date, class_time, max_capacity
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
                class_time,
                max_capacity
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING class_id, name_of_class, user_id, description,
                      class_date, class_time, max_capacity
        `, [
            classData.name_of_class,
            classData.user_id,
            classData.description,
            classData.class_date,
            classData.class_time,
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
                 class_time = $6,
                 max_capacity = $7
             WHERE class_id = $1
             RETURNING class_id, name_of_class, user_id, description,
                       class_date, class_time, max_capacity
        `, [
            classID,
            classData.name_of_class,
            classData.user_id,
            classData.description,
            classData.class_date,
            classData.class_time,
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