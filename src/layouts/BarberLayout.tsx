import { BarberSidebar } from "../components/sidebars/BarberSidebar";
import { ProfileLayout } from "./ProfileLayout";

export function BarberLayout() {
  return <ProfileLayout Sidebar={BarberSidebar} />;
}
