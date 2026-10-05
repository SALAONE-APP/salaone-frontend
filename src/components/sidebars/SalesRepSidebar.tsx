import { ProfileSidebar } from "../shared/ProfileSidebar";
import type { SidebarSection } from "../shared/ProfileSidebar";
import { docsMenuItem } from "./docsMenu";
import { salesCrmProductItems } from "./salesCrmMenu";

const sections: SidebarSection[] = [{ items: [...salesCrmProductItems, docsMenuItem] }];

export function SalesRepSidebar() {
  return <ProfileSidebar title="CRM Comercial" homeHref="/crm-comercial/salaone" sections={sections} />;
}
