import FaSnippetTest from "../../components/FaSnippetTest";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `FA Full-Time Test – ${CLUB.name}`,
    description: "Loads an FA Full-Time code snippet to see what it returns.",
    robots: { index: false },
  };
}

export default function FaTestPage() {
  return <FaSnippetTest />;
}
