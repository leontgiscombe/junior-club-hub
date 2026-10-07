import AdminView from "../../components/AdminView";
import { requireFeature } from "@/lib/settings";

export default async function AdminPage() {
  await requireFeature("kitSizes", "/admin");
  return <AdminView />;
}
