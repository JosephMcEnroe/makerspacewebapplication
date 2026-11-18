import ReservationCheckoutReturn from "@/components/ReservationCheckoutReturn";
import { requireStaffPage } from "@/lib/staffAuth";

export async function getServerSideProps({ req, res, resolvedUrl }) {
  const guard = await requireStaffPage(req, resolvedUrl);
  if (guard.deny) return guard.deny;
  res.setHeader("Cache-Control", "private, no-store");
  return { props: {} };
}

export default function StaffReservationCheckoutReturn() {
  return <ReservationCheckoutReturn staff />;
}
