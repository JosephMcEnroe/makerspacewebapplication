import { query } from "@/lib/db";

export class StudentRepository {
    async findAllStudent() {
        const { rows } = await query(
            `SELECT user_id, student_id, school
             FROM "student"
             ORDER BY student_id`
        );
        return rows;
    }

    async findByStudent(userId) {
        const { rows } = await query(
            `SELECT user_id, student_id, school
             FROM "student"
             WHERE user_id = $1`,
            [userId]
        );
        return rows[0] || null;
    }

    async createStudent(student) {
        const { rows } = await query(
            `INSERT INTO "student" (
                user_id,
                student_id,
                school
            )
            VALUES ($1, $2, $3)
            RETURNING user_id, student_id, school`,
            [
                student.user_id,
                student.student_id,
                student.school
            ]
        );
        return rows[0];
    }
    //Update student's information (if transfer school)
    async updateStudent(userId, student) {
        const { rows } = await query(
            `UPDATE "student"
             SET student_id = $2,
                 school = $3
             WHERE user_id = $1
             RETURNING user_id, student_id, school`,
            [
                userId,
                student.student_id,
                student.school
            ]
        );
        return rows[0] || null;
    }

    async deleteStudent(userId) {
        const { rowCount } = await query(
            `DELETE FROM "student"
             WHERE user_id = $1`,
            [userId]
        );
        return rowCount > 0;
    }
}

export default StudentRepository;