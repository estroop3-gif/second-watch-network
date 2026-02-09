/**
 * CRMOverviewWidget
 * Today's interaction counts and upcoming follow-ups for sales agents
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Phone, Mail, MessageSquare, Monitor, Users, CalendarClock, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

export function CRMOverviewWidget({ className = '' }: SectionProps) {
  const { data: interactions, isLoading: loadingInteractions } = useQuery({
    queryKey: ['crm-my-interactions-today'],
    queryFn: () => api.getCRMMyInteractionsToday(),
    staleTime: 60 * 1000,
  });

  const { data: followUpsData, isLoading: loadingFollowUps } = useQuery({
    queryKey: ['crm-follow-ups'],
    queryFn: () => api.getCRMFollowUps(),
    staleTime: 2 * 60 * 1000,
  });

  if (loadingInteractions && loadingFollowUps) {
    return <WidgetSkeleton className={className} />;
  }

  const counts = interactions || {};
  const followUps = followUpsData?.follow_ups || [];
  const upcomingCount = followUps.length;

  const INTERACTION_ITEMS = [
    { key: 'calls', label: 'Calls', icon: Phone },
    { key: 'emails', label: 'Emails', icon: Mail },
    { key: 'texts', label: 'Texts', icon: MessageSquare },
    { key: 'meetings', label: 'Meetings', icon: Users },
    { key: 'demos', label: 'Demos', icon: Monitor },
  ];

  return (
    <div className={`bg-charcoal-black border border-muted-gray/20 rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading text-bone-white">CRM Overview</h3>
        <Link to="/crm/dashboard">
          <Button variant="ghost" size="sm" className="text-accent-yellow hover:text-accent-yellow/80">
            Open CRM <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Today's interactions */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {INTERACTION_ITEMS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="text-center p-2 rounded-lg bg-muted-gray/10">
            <Icon className="h-4 w-4 text-accent-yellow mx-auto mb-1" />
            <div className="text-xl font-bold text-bone-white">{counts[key] || 0}</div>
            <div className="text-[10px] text-muted-gray">{label}</div>
          </div>
        ))}
      </div>

      {/* Upcoming follow-ups */}
      {upcomingCount > 0 && (
        <div className="border-t border-muted-gray/20 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="h-4 w-4 text-accent-yellow" />
            <span className="text-sm text-bone-white font-medium">
              {upcomingCount} upcoming follow-up{upcomingCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1">
            {followUps.slice(0, 3).map((fu: any) => (
              <Link
                key={fu.id}
                to={`/crm/contacts/${fu.contact_id}`}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-muted-gray/10 transition-colors"
              >
                <span className="text-bone-white/80 truncate">
                  {fu.contact_first_name} {fu.contact_last_name} — {fu.follow_up_notes || fu.subject}
                </span>
                <span className="text-muted-gray ml-2 whitespace-nowrap">
                  {new Date(fu.follow_up_date).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CRMOverviewWidget;
