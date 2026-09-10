import { query } from "@/lib/db";

class UserRepository {
    // search all users
    async findAll() {
        const { rows } = await query(
            `SELECT user_id, first_name, last_name, phone_number,
                date_of_birth, email, notes, rfid_id, last_check_in
             FROM "users"
             ORDER BY last_name, first_name, email`
        );
        return rows;
    }
    //search specific user that have userID
    async findById(userId) {
        const { rows } = await query(
            `SELECT user_id, first_name, last_name, phone_number,
                date_of_birth, email, notes, rfid_id, last_check_in
            FROM "users"
            WHERE (user_id = $1)`,
            [userId]
        );
        return rows[0] || null;
    }
    // Update timestamp for check in after using rfid
    async checkInByRfid(rfidId) {
        const { rows } = await query(`
        UPDATE users
        SET last_check_in = CURRENT_TIMESTAMP
        WHERE rfid_id = $1
        RETURNING user_id, first_name, last_name, rfid_id, last_check_in`,
            [rfidId]);
        return rows[0] || null;
    }

    //create user account
    async createUser(user) {
        const { rows } = await query(`
            INSERT INTO "users" (
            first_name, last_name, phone_number, date_of_birth, email, password, notes, rfid_id, last_check_in)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING user_id, first_name, last_name, phone_number, date_of_birth, email, password, notes, rfid_id, last_check_in
            `, [
            user.first_name,
            user.last_name,
            user.phone_number,
            user.date_of_birth,
            user.email,
            user.password,
            user.notes,
            user.rfid_id,
            user.last_check_in
        ]);
        return rows[0];
    }
    // Update user's information using userID
    async updateUser(userId, user) {
        const { rows } = await query(`
            UPDATE "users"
            SET first_name = $2,
                last_name = $3,
                phone_number = $4,
                date_of_birth = $5,
                email = $6,
                password = $7,
                notes = $8,
                rfid_id = $9,
                WHERE user_id = $1
                RETURNING user_id, first_name, last_name, phone_number, date_of_birth, email, password, notes, rfid_id, last_check_in
                `, [
            userId,
            user.first_name,
            user.last_name,
            user.phone_number,
            user.date_of_birth,
            user.email,
            user.password,
            user.notes,
            user.rfidId,
        ]);
        return rows[0] || null;
    }
    // Login authentication
    async findEmailAuthentication(userEmail) {
        const { rows } = await query(`
            SELECT user_id, email, password, m.type_of_membership
            FROM users
            LEFT JOIN membership m
                on u.user_id = m.user_id
            WHERE email = $1
            `, [userEmail]);

        return rows[0] || null;
    }

}
export default UserRepository;
