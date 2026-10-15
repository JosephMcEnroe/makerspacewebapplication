import { query } from "@/lib/db";

export class paymentRepository {
    async findAllPayment() {
        const { rows } = await query(
            `SELECT payment_id, user_id, membership_id, amount,
                   payment_date, payment_method, stripe_invoice_id
            FROM "payment"`
        );
        return rows;
    }
    //search paymentID to find user
    async findUserPayment(paymentID) {
        const { rows } = await query(
            `SELECT payment_id, user_id, membership_id, amount,
                   payment_date, payment_method, stripe_invoice_id
            FROM "payment"
            WHERE payment_id = $1
            `, [paymentID]
        );
        return rows;
    }
    //search specific user's payments
    async findUserPayments(userId) {
        const { rows } = await query(
            `SELECT payment_id, user_id, membership_id, amount,
                    payment_date, payment_method, stripe_invoice_id
             FROM "payment"
             WHERE user_id = $1
             ORDER BY payment_date DESC`,
            [userId]
        );
        return rows;
    }

    async createPayment(payment) {
        const { rows } = await query(`
            INSERT INTO "payment" (
                user_id,
                membership_id,
                amount,
                payment_date,
                payment_method,
                stripe_invoice_id
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING payment_id, user_id, membership_id, amount,
                      payment_date, payment_method, stripe_invoice_id
        `, [
            payment.user_id,
            payment.membership_id,
            payment.amount,
            payment.payment_date,
            payment.payment_method,
            payment.stripe_invoice_id || null
        ]);
        return rows[0];
    }
}

export default paymentRepository;