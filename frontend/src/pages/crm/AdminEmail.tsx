import { useState } from 'react';
import EmailTemplates from './EmailTemplates';
import EmailAnalytics from './EmailAnalytics';
import EmailSequences from './EmailSequences';
import EmailAccountsAdmin from './EmailAccountsAdmin';

const TABS = ['Templates', 'Sequences', 'Analytics', 'Accounts'] as const;
type Tab = typeof TABS[number];

const AdminEmail = () => {
  const [activeTab, setActiveTab] = useState<Tab>('Templates');

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-muted-gray/20 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-accent-yellow text-accent-yellow'
                : 'border-transparent text-muted-gray hover:text-bone-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Templates' && <EmailTemplates />}
      {activeTab === 'Sequences' && <EmailSequences />}
      {activeTab === 'Analytics' && <EmailAnalytics />}
      {activeTab === 'Accounts' && <EmailAccountsAdmin />}
    </div>
  );
};

export default AdminEmail;
