import { type LucideIcon } from 'lucide-react';

interface KPIMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const KPIMetricCard = ({ title, value, subtitle, icon: Icon, trend, trendValue }: KPIMetricCardProps) => {
  return (
    <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-gray uppercase tracking-wide">{title}</span>
        <Icon className="h-4 w-4 text-muted-gray" />
      </div>
      <p className="text-2xl font-bold text-bone-white">{value}</p>
      {(subtitle || trendValue) && (
        <div className="flex items-center gap-2 mt-1">
          {trendValue && (
            <span className={`text-xs font-medium ${
              trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-muted-gray'
            }`}>
              {trend === 'up' ? '+' : ''}{trendValue}
            </span>
          )}
          {subtitle && <span className="text-xs text-muted-gray">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

export default KPIMetricCard;
