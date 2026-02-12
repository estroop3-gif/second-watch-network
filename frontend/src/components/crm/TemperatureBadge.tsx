import { Badge } from '@/components/ui/badge';

const TEMP_CONFIG: Record<string, { label: string; className: string }> = {
  cold: { label: 'Cold', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  warm: { label: 'Warm', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  hot: { label: 'Hot', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  missed_opportunity: { label: 'Missed', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

interface TemperatureBadgeProps {
  temperature: string;
}

const TemperatureBadge = ({ temperature }: TemperatureBadgeProps) => {
  const config = TEMP_CONFIG[temperature] || TEMP_CONFIG.cold;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
};

export default TemperatureBadge;
