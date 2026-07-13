import { Search, Filter, Plus, MoreHorizontal, Shield, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useTableSelection } from '@/hooks/useTableSelection';

interface Permission {
  id: number;
  name: string;
  description: string;
  module: string;
  roles: string[];
  status: 'enabled' | 'disabled';
}

const permissions: Permission[] = [
  { id: 1, name: 'Dashboard', description: 'Acessar painel de controle', module: 'Dashboard', roles: ['Admin', 'Admin', 'Manager', 'Receptionist', 'Accountant'], status: 'enabled' },
  { id: 2, name: 'Gerenciar Agendamentos', description: 'Criar, editar e cancelar agendamentos', module: 'Bookings', roles: ['Admin', 'Admin', 'Manager', 'Receptionist'], status: 'enabled' },
  { id: 3, name: 'Gerenciar Clientes', description: 'Full customer management access', module: 'Customers', roles: ['Admin', 'Admin', 'Manager', 'Receptionist'], status: 'enabled' },
  { id: 4, name: 'Gerenciar Equipe', description: 'Add, edit and remove staff members', module: 'Staff', roles: ['Admin', 'Admin', 'Manager'], status: 'enabled' },
  { id: 5, name: 'Gerenciar Serviços', description: 'Create and modify services', module: 'Services', roles: ['Admin', 'Admin', 'Manager'], status: 'enabled' },
  { id: 6, name: 'Visualizar Pagamentos', description: 'Access to payment records', module: 'Payments', roles: ['Admin', 'Admin', 'Accountant'], status: 'enabled' },
  { id: 7, name: 'Processar Reembolsos', description: 'Ability to process refunds', module: 'Payments', roles: ['Admin', 'Admin'], status: 'enabled' },
  { id: 8, name: 'Gerenciar Products', description: 'Inventory and product management', module: 'Products', roles: ['Admin', 'Admin', 'Manager'], status: 'enabled' },
  { id: 9, name: 'Visualizar Relatórios', description: 'Access to analytics and reports', module: 'Reports', roles: ['Admin', 'Admin', 'Manager', 'Accountant'], status: 'enabled' },
  { id: 10, name: 'Gerenciar Promotions', description: 'Create and manage promotions', module: 'Promotions', roles: ['Admin', 'Admin', 'Marketing'], status: 'enabled' },
  { id: 11, name: 'Gerenciar Usuarios', description: 'User account management', module: 'Users', roles: ['Admin', 'Admin'], status: 'enabled' },
  { id: 12, name: 'Gerenciar Roles', description: 'Role and permission configuration', module: 'Users', roles: ['Admin'], status: 'enabled' },
];

const moduleColors: Record<string, string> = {
  'Dashboard': 'bg-blue-500/10 text-blue-500',
  'Bookings': 'bg-emerald-500/10 text-emerald-500',
  'Customers': 'bg-purple-500/10 text-purple-500',
  'Staff': 'bg-primary/10 text-primary',
  'Services': 'bg-pink-500/10 text-pink-500',
  'Payments': 'bg-cyan-500/10 text-cyan-500',
  'Products': 'bg-amber-500/10 text-amber-500',
  'Reports': 'bg-indigo-500/10 text-indigo-500',
  'Promotions': 'bg-rose-500/10 text-rose-500',
  'Users': 'bg-violet-500/10 text-violet-500',
};

export function PermissionsPage() {
  const { selectedRows, toggleRow, toggleAll } = useTableSelection(
    permissions.map((permission) => permission.id)
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Permissões</p>
          <h3 className="text-2xl font-semibold text-foreground">50</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Ativos</p>
          <h3 className="text-2xl font-semibold text-foreground">48</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Módulos</p>
          <h3 className="text-2xl font-semibold text-foreground">10</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Papéis com Acesso</p>
          <h3 className="text-2xl font-semibold text-foreground">7</h3>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-medium text-foreground">Todas as Permissões</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input 
                type="text" 
                placeholder="Search permissions..."
                className="w-56 bg-secondary text-sm text-foreground placeholder:text-muted-foreground rounded-md pl-9 pr-3 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter size={14} />
              Filter
            </Button>
            <Button size="sm" className="gap-2">
              <Plus size={14} />
              Adicionar Permissão
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
                    checked={selectedRows.length === permissions.length && permissions.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Permissão</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Roles</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr 
                  key={permission.id} 
                  className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="p-4">
                    <Checkbox 
                      checked={selectedRows.includes(permission.id)}
                      onCheckedChange={() => toggleRow(permission.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-primary" />
                        <span className="text-sm font-medium text-foreground">{permission.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5">{permission.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${moduleColors[permission.module] || ''}`}
                    >
                      {permission.module}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-muted-foreground" />
                      <div className="flex gap-1">
                        {permission.roles.slice(0, 3).map((role, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs px-1.5">
                            {role}
                          </Badge>
                        ))}
                        {permission.roles.length > 3 && (
                          <Badge variant="outline" className="text-xs px-1.5">
                            +{permission.roles.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={permission.status === 'enabled'} />
                      <span className={`text-xs ${permission.status === 'enabled' ? 'text-emerald-500' : 'text-gray-500'}`}>
                        {permission.status}
                      </span>
                    </div>
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
