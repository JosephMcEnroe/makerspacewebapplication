// Placeholder user profile until authentication is wired up to the backend.
// The real profile (with completed trainings) should come from the auth session / database.
export const MOCK_USER = {
  name: "Alex Chen",
  memberSince: "2025",
  // Trainings this user has completed. Names must match the `training`
  // field on rooms / classes / equipment to count as completed.
  completedTrainings: ["Laser Safety Training"],
};

export function hasTraining(user, training) {
  if (!training) return true; // No training required
  return Boolean(user?.completedTrainings?.includes(training));
}
