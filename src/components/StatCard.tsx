import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon: LucideIcon;
  iconBg?: string;
}

export function StatCard({ 
  title, 
  value, 
  change, 
  changeType = 'positive', 
  icon: Icon,
  iconBg = 'bg-primary/10'
}: StatCardProps) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <h3 className="text-2xl font-semibold text-foreground">{value}</h3>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              {changeType === 'positive' ? (
                <TrendingUp size={14} className="text-emerald-500" />
              ) : (
                <TrendingDown size={14} className="text-red-500" />
              )}
              <span className={cn(
                "text-xs font-medium",
                changeType === 'positive' ? "text-emerald-500" : "text-red-500"
              )}>
                {change}
              </span>
            </div>
          )}
        </div>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", iconBg)}>
          <Icon size={20} className="text-primary" />
        </div>
      </div>
    </div>
  );
}
