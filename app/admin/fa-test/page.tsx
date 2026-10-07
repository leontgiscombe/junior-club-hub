import FaSnippetTest from "../../components/FaSnippetTest";
import { CLUB } from "@/club.config";

export const metadata = {
  title: `FA Full-Time Test – ${CLUB.name}`,
  description: "Loads an FA Full-Time code snippet to see what it returns.",
  robots: { index: false },
};

export default function FaTestPage() {
  return <FaSnippetTest />;
}
