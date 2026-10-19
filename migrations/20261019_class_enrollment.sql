-- Class sign-ups. Previously created on the fly by /api/reservations/class,
-- which left /api/resources/classes failing until the first enrollment.
CREATE TABLE IF NOT EXISTS "class_enrollment" (
  user_id INTEGER NOT NULL REFERENCES "users"(user_id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES "class"(class_id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, class_id)
);
