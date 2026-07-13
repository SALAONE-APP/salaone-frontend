import { SuperAdminSidebar } from "../components/sidebars/SuperAdminSidebar";
import { ProfileLayout } from "./ProfileLayout";

export function SuperAdminLayout() {
  return <ProfileLayout Sidebar={SuperAdminSidebar} />;
}
