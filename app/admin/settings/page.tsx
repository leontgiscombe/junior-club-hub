import ClubSettings from "../../components/ClubSettings";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Settings – ${CLUB.name}`,
    description: `The club's name, crest and slogan across the ${CLUB.fullName} Team Hub.`,
  };
}

export default function SettingsPage() {
  return <ClubSettings />;
}
