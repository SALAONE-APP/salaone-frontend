import { AdminSidebar } from "../components/sidebars/AdminSidebar";
import { ProfileLayout } from "./ProfileLayout";

export function AdminLayout() {
  return (
    <ProfileLayout Sidebar={AdminSidebar} />
  );
}
