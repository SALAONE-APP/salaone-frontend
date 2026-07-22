import { Search, Filter, Plus, MoreHorizontal, Shield, Users, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTableSelection } from '@/hooks/useTableSelection';

interface Role {
  id: number;
  name: string;
  description: string;
  users: number;
  permissions: number;
  status: 'active' | 'inactive';
}

const roles: Role[] = [
  { id: 1, name: 'Admin', description: 'Full system access and control', users: 1, permissions: 50, status: 'active' },
  { id: 2, name: 'Admin-Restricted', description: 'Administrative access with some restrictions', users: 1, permissions: 40, status: 'active' },
  { id: 3, name: 'Manager', description: 'Manage staff, bookings and daily operations', users: 1, permissions: 30, status: 'active' },
  { id: 4, name: 'Receptionist', description: 'Handle bookings and customer service', users: 1, permissions: 15, status: 'active' },
  { id: 5, name: 'Accountant', description: 'Financial and payment management', users: 1, permissions: 20, status: 'inactive' },
  { id: 6, name: 'Marketing', description: 'Promotions and customer communications', users: 1, permissions: 10, status: 'active' },
  { id: 7, name: 'Professional', description: 'View schedule and manage appointments', users: 6, permissions: 8, status: 'active' },
];



export function RolesPage() {
  const { selectedRows, toggleRow, toggleAll } = useTableSelection(
    roles.map((role) => role.id)
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Roles</p>
          <h3 className="text-2xl font-semibold text-foreground">7</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Active</p>
          <h3 className="text-2xl font-semibold text-foreground">6</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Users</p>
          <h3 className="text-2xl font-semibold text-foreground">12</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Permissions</p>
          <h3 className="text-2xl font-semibold text-foreground">50</h3>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-medium text-foreground">All Roles</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input 
                type="text" 
                placeholder="Search roles..."
                className="w-56 bg-secondary text-sm text-foreground placeholder:text-muted-foreground rounded-md pl-9 pr-3 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter size={14} />
              Filter
            </Button>
            <Button size="sm" className="gap-2">
              <Plus size={14} />
              Add Role
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="w-10 p-4">
                  <Checkbox 
                    checked={selectedRows.length === roles.length && roles.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Users</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Permissions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr 
                  key={role.id} 
                  className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="p-4">
                    <Checkbox 
                      checked={selectedRows.includes(role.id)}
                      onCheckedChange={() => toggleRow(role.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-primary" />
                      <span className="text-sm font-medium text-foreground">{role.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{role.description}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Users size={14} className="text-muted-foreground" />
                      {role.users} users
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Lock size={14} className="text-muted-foreground" />
                      {role.permissions} permissions
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge 
                      variant="outline" 
                      className={`text-xs capitalize px-2 py-0.5 rounded-full ${
                        role.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                      }`}
                    >
                      {role.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
