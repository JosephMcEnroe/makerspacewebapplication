export function refundLabel(status, amount) {
  if (!status || status === "not_required") return "No refund";
  if (status === "succeeded") return `Refunded $${Number(amount).toFixed(2)}`;
  if (status === "failed") return "Refund needs attention — contact staff";
  return `Refund processing — $${Number(amount).toFixed(2)}`;
}
