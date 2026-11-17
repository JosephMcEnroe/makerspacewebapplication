import ExplorePage from "@/components/ExplorePage";
import { loadEquipment } from "@/lib/resources";
import { getSessionUser } from "@/lib/session";

export async function getServerSideProps({ req, res }) {
  res.setHeader("Cache-Control", "private, no-store");
  const user = await getSessionUser(req);
  return { props: { equipment: await loadEquipment({ user }) } };
}

export default function EquipmentPage({ equipment }) {
  return (
    <ExplorePage
      title="Equipment"
      resourceType="equipment"
      intro="Explore the equipment available at The Crafty Studio, from precision cutters to printing and fabrication tools."
      bookingWindow="Equipment can be reserved up to 1 month in advance."
      items={equipment}
    />
  );
}
