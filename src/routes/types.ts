import type { ComponentType } from "react";

import type { PermissionKey } from "../hooks/usePermissions";

export interface AppRoute {
  path: string;
  title: string;
  breadcrumbs: string[];
  Component: ComponentType;
  requiredPermission?: PermissionKey;
}
