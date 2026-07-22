import { Search, Filter, Plus, MoreHorizontal, Star, DollarSign, Scissors, Mail, Phone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


interface StaffMember {
  id: number;
  name: string;
  role: string;
  email: string;
  phone: string;
  rating: number;
  services: number;
  revenue: number;
  status: 'ativos' | 'inativos';
  avatar: string;
}

const staffMembers: StaffMember[] = [
  { id: 1, name: 'Rodrigues', role: 'Senior Professional', email: 'rodrigues@salaone.com.br', phone: '(85) 98765-8585', rating: 4.7, services: 156, revenue: 7850, status: 'ativos', avatar: 'https://i.pravatar.cc/150?u=olivia' },
  { id: 2, name: 'Pedro', role: 'Senior Professional', email: 'pedro@salaone.com.br', phone: '(85) 98765-2222', rating: 4.7, services: 142, revenue: 7100, status: 'ativos', avatar: 'https://i.pravatar.cc/150?u=daniel' },
  { id: 3, name: 'James Anderson', role: 'Senior Professional', email: 'james@salaone.com.br', phone: '(85) 98765-3333', rating: 4.7, services: 138, revenue: 6900, status: 'ativos', avatar: 'https://i.pravatar.cc/150?u=james' },
  { id: 4, name: 'Olivia Brown', role: 'Senior Professional', email: 'olivia@salaone.com.br', phone: '(85) 98765-4444', rating: 4.7, services: 145, revenue: 7250, status: 'ativos', avatar: 'https://i.pravatar.cc/150?u=lucas' },
  { id: 5, name: 'Michael Thompson', role: 'Senior Professional', email: 'michael@salaone.com.br', phone: '(85) 98765-5555', rating: 4.7, services: 132, revenue: 6600, status: 'ativos', avatar: 'https://i.pravatar.cc/150?u=michael' },
  { id: 6, name: 'Emily Carter', role: 'Junior Professional', email: 'emily@salaone.com.br', phone: '(85) 98765-6666', rating: 4.5, services: 89, revenue: 3560, status: 'ativos', avatar: 'https://i.pravatar.cc/150?u=emily' },
];

export function StaffPage() {


  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Agendamentos</p>
          <h3 className="text-2xl font-semibold text-foreground">6</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Ativos</p>
          <h3 className="text-2xl font-semibold text-foreground">6</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Serviços</p>
          <h3 className="text-2xl font-semibold text-foreground">802</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Racking</p>
          <h3 className="text-2xl font-semibold text-foreground">4.7</h3>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-medium text-foreground">Todos os Funcionários</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input 
                type="text" 
                placeholder="Search staff..."
                className="w-56 bg-secondary text-sm text-foreground placeholder:text-muted-foreground rounded-md pl-9 pr-3 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter size={14} />
              Filtro
            </Button>
            <Button size="sm" className="gap-2">
              <Plus size={14} />
              Adicionar Funcionário
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">

                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Funcionário</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Contato</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Avaliação</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Serviços</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {staffMembers.map((staff) => (
                <tr 
                  key={staff.id} 
                  className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors"
                >

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={staff.avatar} alt={staff.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {staff.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">{staff.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail size={12} />
                        {staff.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone size={12} />
                        {staff.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-amber-500 fill-amber-500" />
                      <span className="text-sm font-medium text-foreground">{staff.rating}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Scissors size={14} className="text-muted-foreground" />
                      {staff.services}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <DollarSign size={14} className="text-emerald-500" />
                      {staff.revenue.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge 
                      variant="outline" 
                      className={`text-xs capitalize px-2 py-0.5 rounded-full ${
                        staff.status === 'ativos' 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                      }`}
                    >
                      {staff.status}
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
