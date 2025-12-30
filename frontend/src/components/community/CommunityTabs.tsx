/**
 * CommunityTabs - Tab navigation for Community Hub
 */
import React from 'react';
import { Home, Users, Handshake, MessageSquare, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CommunityTabType = 'home' | 'people' | 'collabs' | 'topics' | 'feed';

interface Tab {
  id: CommunityTabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
  { id: 'feed', label: 'Feed', icon: <Newspaper className="w-4 h-4" /> },
  { id: 'people', label: 'People', icon: <Users className="w-4 h-4" /> },
  { id: 'collabs', label: 'Collabs', icon: <Handshake className="w-4 h-4" /> },
  { id: 'topics', label: 'Topics', icon: <MessageSquare className="w-4 h-4" /> },
];

interface CommunityTabsProps {
  activeTab: CommunityTabType;
  onTabChange: (tab: CommunityTabType) => void;
}

const CommunityTabs: React.FC<CommunityTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="border-b border-muted-gray/30 mb-8">
      <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Community tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-accent-yellow text-accent-yellow'
                : 'border-transparent text-muted-gray hover:text-bone-white hover:border-muted-gray/50'
            )}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default CommunityTabs;
