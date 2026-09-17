import { query } from "@/lib/db";

export class logRepository {
    //DSEC latest start_time 
    async findAllImpersonationLog() {
        const { rows } = await query(
            `SELECT log_id, admin_id, target_user_id, start_time,
                    end_time, actions_performed
             FROM "impersonation_log"
             ORDER BY start_time DESC`
        );
        return rows;
    }
    async findImpersonationLog(logID) {
        const { rows } = await query(
            `SELECT log_id, admin_id, target_user_id, start_time,
                    end_time, actions_performed
             FROM "impersonation_log"
             WHERE log_id = $1`,
            [logID]
        );
        return rows[0] || null;
    }
    async findAdminImpersonationLog(adminID) {
        const { rows } = await query(
            `SELECT log_id, admin_id, target_user_id, start_time,
                    end_time, actions_performed
             FROM "impersonation_log"
             WHERE admin_id = $1
             ORDER BY start_time DESC`,
            [adminID]
        );
        return rows;
    }
    async findUserImpersonationLog(userID) {
        const { rows } = await query(
            `SELECT log_id, admin_id, target_user_id, start_time,
                    end_time, actions_performed
             FROM "impersonation_log"
             WHERE target_user_id = $1
             ORDER BY start_time DESC`,
            [userID]
        );
        return rows;
    }
    async createImpersonationLog(log) {
        const { rows } = await query(
            `INSERT INTO "impersonation_log" (
                admin_id,
                target_user_id,
                start_time,
                end_time,
                actions_performed
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING log_id, admin_id, target_user_id, start_time,
                      end_time, actions_performed`,
            [
                log.admin_id,
                log.target_user_id,
                log.start_time,
                log.end_time,
                log.actions_performed
            ]
        );
        return rows[0];
    }
}
export default logRepository;