import { ClientSidebar } from "../components/sidebars/ClientSidebar";
import { ProfileLayout } from "./ProfileLayout";

export function ClientLayout() {
  return <ProfileLayout Sidebar={ClientSidebar} />;
}
