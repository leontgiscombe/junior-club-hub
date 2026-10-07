import CameraRegister from "../../components/CameraRegister";
import { CLUB } from "@/club.config";

export const metadata = {
  title: `Camera Register – ${CLUB.name}`,
  description: "Coaches' register for tracking home-game footage and cloud uploads.",
};

export default function CameraPage() {
  return <CameraRegister />;
}
