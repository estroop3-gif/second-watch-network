import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Plus, Ban, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ThreadList } from '@/components/backlot/ThreadList';
import { NewThreadModal } from '@/components/backlot/NewThreadModal';
import { usePermissions } from '@/hooks/usePermissions';
import { UpgradeGateButton } from '@/components/upgrade/UpgradeGate';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const fetchCategories = async () => {
  const data = await api.listForumCategories();
  return data;
};

const TheBacklot = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { /* roles, */ } = usePermissions();
  const { isAuthenticated } = useAuth();
  const { data: categories, isLoading } = useQuery({
    queryKey: ['forum_categories'],
    queryFn: fetchCategories,
  });

  // Check forum ban status for authenticated users
  const { data: forumStatus } = useQuery({
    queryKey: ['user-forum-status'],
    queryFn: () => api.getUserForumStatus(),
    enabled: isAuthenticated,
  });

  const location = useLocation();
  const navigate = useNavigate();
  const headingRef = useState<HTMLHeadingElement | null>(null)[0] as unknown as React.MutableRefObject<HTMLHeadingElement | null>;

  // Ban status helpers
  const isBanned = forumStatus?.is_banned || false;
  const banType = forumStatus?.restriction_type;
  const isFullBlock = banType === 'full_block';
  const isReadOnly = banType === 'read_only';
  // shadow_restrict doesn't affect UI - backend handles filtering

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resume = params.get('resume') === '1';
    const context = params.get('context');
    if (resume && context === 'forum_post') {
      setIsModalOpen(true);
      // Clean URL
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  // Initialize active section from ?tab= or #hash
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlTab = params.get('tab');
    const hash = location.hash?.replace('#', '');
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
      return;
    }
    if (hash && hash !== activeTab) {
      setActiveTab(hash);
    }
  }, [location.search, location.hash]);

  // When section changes, sync URL (?tab and hash) and focus heading
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    params.set('tab', activeTab);
    navigate({ pathname: location.pathname, search: `?${params.toString()}`, hash: activeTab !== 'all' ? `#${activeTab}` : '' }, { replace: true });
    // a11y: move focus to the main heading
    const h = document.getElementById('backlot-heading') as HTMLHeadingElement | null;
    if (h) {
      h.setAttribute('tabindex', '-1');
      setTimeout(() => h.focus(), 150);
    }
  }, [activeTab]);

  // Helper to get a human label for current tab
  const currentLabel = (() => {
    if (activeTab === 'all') return 'Explore All';
    const match = categories?.find((c: any) => c.slug === activeTab);
    return match?.name || activeTab;
  })();

  // Full block: Show restricted message instead of forum
  if (isFullBlock) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-8">
        <div className="text-center mb-12">
          <h1 id="backlot-heading" className="text-4xl md:text-6xl font-heading tracking-tighter mb-2 -rotate-1">
            The <span className="font-spray text-accent-yellow">Backlot</span>
          </h1>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-8 text-center">
            <Ban className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-heading text-bone-white mb-4">Forum Access Restricted</h2>
            <p className="text-muted-gray mb-4">
              Your access to The Backlot has been restricted.
            </p>
            {forumStatus?.reason && (
              <p className="text-sm text-red-400 mb-4">
                <strong>Reason:</strong> {forumStatus.reason}
              </p>
            )}
            {forumStatus?.expires_at && (
              <p className="text-sm text-muted-gray">
                This restriction expires on {format(new Date(forumStatus.expires_at), 'PPP')}
              </p>
            )}
            {!forumStatus?.expires_at && (
              <p className="text-sm text-muted-gray">
                If you believe this was in error, please contact support.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 md:px-8 py-8">
        <div className="text-center mb-12">
          <h1 id="backlot-heading" className="text-4xl md:text-6xl font-heading tracking-tighter mb-2 -rotate-1">
            The <span className="font-spray text-accent-yellow">Backlot</span>
          </h1>
          <p className="text-lg text-muted-gray">
            Where independent voices come together.
          </p>
        </div>

        {/* Read-only notice for restricted users */}
        {isReadOnly && (
          <Alert variant="destructive" className="mb-6 max-w-2xl mx-auto bg-yellow-900/20 border-yellow-600/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Posting Restricted</AlertTitle>
            <AlertDescription>
              You are currently in read-only mode and cannot create new threads or replies.
              {forumStatus?.reason && <span className="block mt-1">Reason: {forumStatus.reason}</span>}
              {forumStatus?.expires_at && (
                <span className="block mt-1">
                  Expires: {format(new Date(forumStatus.expires_at), 'PPP')}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* aria-live: announce section changes */}
        <div className="sr-only" aria-live="polite">{`Backlot — ${currentLabel}`}</div>

        {/* Mobile: Section dropdown (replaces tabs) */}
        <div className="sm:hidden mb-4">
          <label htmlFor="mobile-section" className="block text-sm font-medium text-bone-white mb-2">
            Section
          </label>
          <Select value={activeTab} onValueChange={(v) => setActiveTab(v)}>
            <SelectTrigger id="mobile-section" aria-label="Select backlot section" className="w-full">
              <SelectValue placeholder="Explore All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Explore All</SelectItem>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SelectItem key={i} value={`loading-${i}`} disabled>Loading...</SelectItem>)
              ) : (
                categories?.map((category: any) => (
                  <SelectItem key={category.id} value={category.slug}>{category.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Desktop/Tablet: keep tabs with extra spacing from filters row */}
          <TabsList className="hidden sm:grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 bg-transparent p-0 mt-8">
            <TabsTrigger value="all" className="data-[state=active]:bg-muted-gray/50 data-[state=active]:text-accent-yellow">Explore All</TabsTrigger>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : (
              categories?.map(category => (
                <TabsTrigger key={category.id} value={category.slug} className="data-[state=active]:bg-muted-gray/50 data-[state=active]:text-accent-yellow">
                  {category.name}
                </TabsTrigger>
              ))
            )}
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <ThreadList />
          </TabsContent>
          {categories?.map(category => (
            <TabsContent key={category.id} value={category.slug} className="mt-6">
              <ThreadList categorySlug={category.slug} />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Hide post button for banned/read-only users */}
      {!isBanned && !isReadOnly && (
        <UpgradeGateButton requiredPerm="forum_post" onClickAllowed={() => setIsModalOpen(true)}>
          <Button
            className="fixed bottom-8 right-8 rounded-full h-16 w-16 bg-accent-yellow text-charcoal-black hover:bg-bone-white shadow-lg transform transition-transform hover:scale-110"
          >
            <Plus className="h-8 w-8" />
            <span className="sr-only">Start a New Thread</span>
          </Button>
        </UpgradeGateButton>
      )}

      <NewThreadModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
};

export default TheBacklot;
