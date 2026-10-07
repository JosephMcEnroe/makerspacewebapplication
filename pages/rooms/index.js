import ExplorePage from "@/components/ExplorePage";
import { loadRooms } from "@/lib/resources";

export async function getServerSideProps() {
  return { props: { rooms: await loadRooms() } };
}

export default function RoomsPage({ rooms }) {
  return (
    <ExplorePage
      type="rooms"
      title="Rooms"
      intro="Explore the rooms available at The Crafty Studio, from open studios to specialized workshop spaces. Click any room to reserve it."
      bookingWindow="Rooms can be reserved up to 3 months in advance."
      items={rooms}
    />
  );
}
