import { ReceptionistSidebar } from "../components/sidebars/ReceptionistSidebar";
import { ProfileLayout } from "./ProfileLayout";

export function ReceptionistLayout() {
  return <ProfileLayout Sidebar={ReceptionistSidebar} />;
}
