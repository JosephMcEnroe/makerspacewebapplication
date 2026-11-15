# Membership requirements

Self-service reservations and rescheduling require an active membership or valid day pass. This applies to rooms, monthly studios, equipment (including free studio-covered equipment), and classes. Staff can continue to book on behalf of inactive members through staff tools.

Eligibility uses the stored membership status and dates at the time of the request. Status must be `ACTIVE` (ignoring case and surrounding whitespace). A future start or expired end denies eligibility even if the status still says `ACTIVE`. Missing dates are open-ended; malformed supplied dates deny eligibility.

Date-only expiration values include the entire calendar day in America/New_York. Timestamp expiration values are exclusive: access ends at the specified time. Queries preserve the date text so a date-only expiration cannot be mistaken for a midnight timestamp.

Members can reserve future dates beyond the currently paid membership period, within normal booking windows. Space, equipment, and studio RFID check-in independently require current eligibility. Equipment and studio check-in also require a current reservation. Staff-created reservations do not bypass RFID membership eligibility.

Expired members can still view and cancel existing reservations and purchase membership. Existing reservations are retained. Completed Stripe payments are still fulfilled if membership expires after checkout started.

Reservation APIs respond with HTTP 403 and `code: MEMBERSHIP_REQUIRED` when eligibility is missing. `/api/auth/checkC` exposes `user.membershipActive` for the booking UI. The membership dialog links to `/membership`; membership is checked before the waiver prompt. APIs always check current database-backed membership independently of client state.
