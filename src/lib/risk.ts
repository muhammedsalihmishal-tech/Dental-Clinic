/**
 * Computes a no-show risk score (0–100) from a patient's history.
 * Factors: past no-show rate, recent no-shows, cancelled appointments,
 * days since last visit (longer gap = higher risk).
 */
export function noShowRiskScore(patient: {
  appointments: { status: string; start: Date }[];
}): { score: number; label: "Low" | "Medium" | "High"; color: string } {
  const appts = patient.appointments.filter((a) =>
    ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(a.status),
  );
  if (appts.length === 0) return { score: 0, label: "Low", color: "#14b8a6" };

  const noShows = appts.filter((a) => a.status === "NO_SHOW").length;
  const cancels = appts.filter((a) => a.status === "CANCELLED").length;
  const completed = appts.filter((a) => a.status === "COMPLETED").length;

  // Recent no-shows (last 3 months) weigh more
  const cutoff = new Date(Date.now() - 90 * 86_400_000);
  const recentNoShows = appts.filter((a) => a.status === "NO_SHOW" && a.start > cutoff).length;

  // Days since last completed visit
  const lastCompleted = appts
    .filter((a) => a.status === "COMPLETED")
    .sort((a, b) => b.start.getTime() - a.start.getTime())[0];
  const daysSinceVisit = lastCompleted
    ? Math.floor((Date.now() - lastCompleted.start.getTime()) / 86_400_000)
    : 999;

  let score = 0;
  // No-show rate (0–40 points)
  const noShowRate = appts.length > 0 ? noShows / appts.length : 0;
  score += Math.round(noShowRate * 40);
  // Recent no-shows boost (0–20 points)
  score += Math.min(recentNoShows * 10, 20);
  // Cancellation tendency (0–15 points)
  const cancelRate = appts.length > 0 ? cancels / appts.length : 0;
  score += Math.round(cancelRate * 15);
  // Long gap since last visit (0–25 points)
  if (daysSinceVisit > 365) score += 25;
  else if (daysSinceVisit > 180) score += 15;
  else if (daysSinceVisit > 90) score += 8;

  score = Math.min(100, Math.max(0, score));

  if (score >= 50) return { score, label: "High", color: "#f43f5e" };
  if (score >= 25) return { score, label: "Medium", color: "#f59e0b" };
  return { score, label: "Low", color: "#14b8a6" };
}
