import { getPool } from "@/lib/db";
export class PasswordResetRepository {
    // Create a password reset token
    async createResetToken(userId, tokenHash) {
        const pool = getPool();

        const { rows } = await pool.query(
            `INSERT INTO password_reset (
                user_id,
                token_hash,
                expires_at,
                used
            )
            VALUES (
                $1,
                $2,
                NOW() + INTERVAL '30 minutes',
                FALSE
            )
            RETURNING reset_id, user_id, expires_at`,
            [userId, tokenHash]
        );
        return rows[0] || null;
    }
    // Invalidate all unused reset tokens for a user
    async invalidateUserTokens(userId) {
        const pool = getPool();

        const { rowCount } = await pool.query(
            `UPDATE password_reset
             SET used = TRUE
             WHERE user_id = $1
               AND used = FALSE`,
            [userId]
        );
        return rowCount;
    }
    // Reset password, consume token, and invalidate sessions
    async resetPassword(tokenHash, passwordHash) {
        const pool = getPool();
        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            // Find a valid, unused, non-expired reset token
            const tokenResult = await client.query(
                `SELECT reset_id, user_id
                 FROM password_reset
                 WHERE token_hash = $1
                   AND used = FALSE
                   AND expires_at > NOW()
                 FOR UPDATE`,
                [tokenHash]
            );
            if (tokenResult.rowCount === 0) {
                await client.query("ROLLBACK");
                return false;
            }
            const { reset_id, user_id } = tokenResult.rows[0];
            // Update the user's password
            const userResult = await client.query(
                `UPDATE users
                 SET password = $2
                 WHERE user_id = $1
                 RETURNING user_id`,
                [user_id, passwordHash]
            );

            if (userResult.rowCount === 0) {
                await client.query("ROLLBACK");
                return false;
            }

            // Invalidate all unused reset tokens for this user
            await client.query(
                `UPDATE password_reset
                 SET used = TRUE
                 WHERE user_id = $1
                   AND used = FALSE`,
                [user_id]
            );

            // Remove all existing sessions for this user
            await client.query(
                `DELETE FROM sessions
                 WHERE user_id = $1`,
                [user_id]
            );

            await client.query("COMMIT");

            return true;

        } catch (error) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Password reset rollback error:", rollbackError);
            }

            throw error;
        } finally {
            client.release();
        }
    }
}

export default PasswordResetRepository;
