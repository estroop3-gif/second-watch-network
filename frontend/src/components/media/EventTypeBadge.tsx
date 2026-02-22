import {
  Video, Users, Film, Tv, Mic, Camera, Radio, HelpCircle,
} from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  content_shoot: { icon: Video, label: 'Content Shoot', color: 'text-blue-400 bg-blue-900/30' },
  meetup: { icon: Users, label: 'Meetup', color: 'text-purple-400 bg-purple-900/30' },
  premiere: { icon: Film, label: 'Premiere', color: 'text-amber-400 bg-amber-900/30' },
  watch_party: { icon: Tv, label: 'Watch Party', color: 'text-green-400 bg-green-900/30' },
  interview: { icon: Mic, label: 'Interview', color: 'text-cyan-400 bg-cyan-900/30' },
  photoshoot: { icon: Camera, label: 'Photoshoot', color: 'text-pink-400 bg-pink-900/30' },
  livestream: { icon: Radio, label: 'Livestream', color: 'text-red-400 bg-red-900/30' },
  other: { icon: HelpCircle, label: 'Other', color: 'text-slate-400 bg-slate-900/30' },
};

const EventTypeBadge = ({ type }: { type: string }) => {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.other;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
};

export default EventTypeBadge;
