import CameraRegister from "../../components/CameraRegister";
import { getClub, requireFeature } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Camera Register – ${CLUB.name}`,
    description: "Coaches' register for tracking home-game footage and cloud uploads.",
  };
}

export default async function CameraPage() {
  await requireFeature("cameraRegister", "/admin");
  return <CameraRegister />;
}
