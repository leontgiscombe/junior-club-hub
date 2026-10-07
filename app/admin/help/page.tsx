import HelpManual from "../../components/HelpManual";
import { CLUB } from "@/club.config";

export const metadata = {
  title: `Help – ${CLUB.name}`,
  description: `How to use the ${CLUB.fullName} Team Hub.`,
};

export default function HelpPage() {
  return <HelpManual />;
}
