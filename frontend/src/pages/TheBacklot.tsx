import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ThreadList } from '@/components/backlot/ThreadList';
import { NewThreadModal } from '@/components/backlot/NewThreadModal';
import { usePermissions } from '@/hooks/usePermissions';
import { UpgradeGateButton } from '@/components/upgrade/UpgradeGate';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const { data: categories, isLoading } = useQuery({
    queryKey: ['forum_categories'],
    queryFn: fetchCategories,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const headingRef = useState<HTMLHeadingElement | null>(null)[0] as unknown as React.MutableRefObject<HTMLHeadingElement | null>;

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

      <UpgradeGateButton requiredPerm="forum_post" onClickAllowed={() => setIsModalOpen(true)}>
        <Button
          className="fixed bottom-8 right-8 rounded-full h-16 w-16 bg-accent-yellow text-charcoal-black hover:bg-bone-white shadow-lg transform transition-transform hover:scale-110"
        >
          <Plus className="h-8 w-8" />
          <span className="sr-only">Start a New Thread</span>
        </Button>
      </UpgradeGateButton>

      <NewThreadModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
};

export default TheBacklot;
