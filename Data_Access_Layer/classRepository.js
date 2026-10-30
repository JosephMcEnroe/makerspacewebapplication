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

    // Classes with instructor name and how many members are enrolled
    async findAllClassWithEnrollment() {
        const select = (enrolled) => `
            SELECT c.class_id, c.name_of_class, c.user_id, c.description,
                   c.class_date, c.max_capacity,
                   u.first_name AS instructor_first_name,
                   u.last_name AS instructor_last_name,
                   ${enrolled} AS enrolled
            FROM "class" c
            LEFT JOIN "users" u ON u.user_id = c.user_id
            ORDER BY c.class_date
        `;
        const { rows } = await query(select(
            `(SELECT COUNT(*)::integer FROM "class_enrollment" e WHERE e.class_id = c.class_id)`
        )).catch((error) => {
            // class_enrollment is created lazily on the first class booking
            if (error.code !== "42P01") throw error;
            return query(select("0"));
        });
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