import { Search, Filter, Plus, MoreHorizontal, Tag, Calendar, Percent, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTableSelection } from '@/hooks/useTableSelection';

interface Promotion {
  id: number;
  name: string;
  description: string;
  discount: number;
  code: string;
  startDate: string;
  endDate: string;
  usage: number;
  status: 'active' | 'expired' | 'scheduled';
}

const promotions: Promotion[] = [
  { id: 1, name: 'Summer Special', description: '20% off all services', discount: 20, code: 'SUMMER20', startDate: 'Jun 1, 2025', endDate: 'Aug 31, 2025', usage: 145, status: 'active' },
  { id: 2, name: 'New Client', description: 'First visit 30% off', discount: 30, code: 'NEWBIE30', startDate: 'Jan 1, 2025', endDate: 'Dec 31, 2025', usage: 89, status: 'active' },
  { id: 3, name: 'Loyalty Reward', description: '10% off for regulars', discount: 10, code: 'LOYAL10', startDate: 'Jan 1, 2025', endDate: 'Dec 31, 2025', usage: 234, status: 'active' },
  { id: 4, name: 'Weekend Special', description: '15% off on weekends', discount: 15, code: 'WEEKEND15', startDate: 'May 1, 2025', endDate: 'May 31, 2025', usage: 67, status: 'expired' },
  { id: 5, name: 'Birthday Deal', description: 'Free service on birthday', discount: 100, code: 'BIRTHDAY', startDate: 'Jan 1, 2025', endDate: 'Dec 31, 2025', usage: 45, status: 'active' },
  { id: 6, name: 'Black Friday', description: '50% off all services', discount: 50, code: 'BLACK50', startDate: 'Nov 28, 2025', endDate: 'Nov 30, 2025', usage: 0, status: 'scheduled' },
];

const statusStyles = {
  active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  expired: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

export function PromotionsPage() {
  const { selectedRows, toggleRow, toggleAll } = useTableSelection(
    promotions.map((promotion) => promotion.id)
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Promotions</p>
          <h3 className="text-2xl font-semibold text-foreground">12</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Active</p>
          <h3 className="text-2xl font-semibold text-foreground">4</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Usage</p>
          <h3 className="text-2xl font-semibold text-foreground">580</h3>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Revenue Impact</p>
          <h3 className="text-2xl font-semibold text-foreground">$8,450</h3>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-medium text-foreground">All Promotions</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input 
                type="text" 
                placeholder="Search promotions..."
                className="w-56 bg-secondary text-sm text-foreground placeholder:text-muted-foreground rounded-md pl-9 pr-3 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter size={14} />
              Filter
            </Button>
            <Button size="sm" className="gap-2">
              <Plus size={14} />
              Add Promotion
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
                    checked={selectedRows.length === promotions.length && promotions.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Promotion</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Discount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Usage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promo) => (
                <tr 
                  key={promo.id} 
                  className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="p-4">
                    <Checkbox 
                      checked={selectedRows.includes(promo.id)}
                      onCheckedChange={() => toggleRow(promo.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="text-primary" />
                        <p className="text-sm font-medium text-foreground">{promo.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5">{promo.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="px-2 py-1 bg-secondary rounded text-sm font-mono text-primary">
                      {promo.code}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Percent size={14} className="text-emerald-500" />
                      {promo.discount}%
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar size={12} />
                        {promo.startDate}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar size={12} />
                        {promo.endDate}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Users size={14} className="text-primary" />
                      {promo.usage} uses
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge 
                      variant="outline" 
                      className={`text-xs capitalize px-2 py-0.5 rounded-full ${statusStyles[promo.status]}`}
                    >
                      {promo.status}
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
