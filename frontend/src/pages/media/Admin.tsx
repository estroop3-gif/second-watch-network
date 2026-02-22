import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Inbox, Settings2, FileBarChart } from 'lucide-react';

const EmailLogs = React.lazy(() => import('../admin/EmailLogs'));
const AdminEmailAccounts = React.lazy(() => import('../admin/AdminEmailAccounts'));
const AdminEmailInbox = React.lazy(() => import('../admin/AdminEmailInbox'));

type Tab = 'inbox' | 'accounts' | 'logs';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'accounts', label: 'Accounts', icon: Settings2 },
  { id: 'logs', label: 'Logs', icon: FileBarChart },
];

const MediaAdmin = () => {
  const [activeTab, setActiveTab] = useState<Tab>('inbox');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading text-accent-yellow">Admin</h1>
        <p className="text-muted-gray">Manage media hub email accounts, inboxes, and delivery logs</p>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 border-b border-muted-gray/30 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition-colors',
              activeTab === tab.id
                ? 'border-accent-yellow text-accent-yellow'
                : 'border-transparent text-muted-gray hover:text-bone-white'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <React.Suspense fallback={<div className="text-muted-gray py-12 text-center">Loading...</div>}>
        {activeTab === 'inbox' && <AdminEmailInbox />}
        {activeTab === 'accounts' && <AdminEmailAccounts />}
        {activeTab === 'logs' && <EmailLogs />}
      </React.Suspense>
    </div>
  );
};

export default MediaAdmin;
