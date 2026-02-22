import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Zap, Star, Rocket, Building2, Crown, Package } from 'lucide-react';

// Mirror backend pricing constants (v2)
const TIERS: Record<string, TierDef> = {
  free: {
    base_price: 0,
    org_seats: { owner: 1, collaborative: 0 },
    active_projects: 1,
    project_seats: { non_collaborative: 0, view_only: 2 },
    storage: { active_gb: 5, archive_gb: 0 },
    bandwidth_gb: 10,
  },
  indie: {
    base_price: 69,
    org_seats: { owner: 1, collaborative: 5 },
    active_projects: 5,
    project_seats: { non_collaborative: 5, view_only: 10 },
    storage: { active_gb: 150, archive_gb: 100 },
    bandwidth_gb: 500,
  },
  pro: {
    base_price: 149,
    org_seats: { owner: 2, collaborative: 15 },
    active_projects: 15,
    project_seats: { non_collaborative: 10, view_only: 15 },
    storage: { active_gb: 1024, archive_gb: 1024 },
    bandwidth_gb: 3000,
  },
  business: {
    base_price: 349,
    org_seats: { owner: 3, collaborative: 50 },
    active_projects: 50,
    project_seats: { non_collaborative: 15, view_only: 50 },
    storage: { active_gb: 5120, archive_gb: 10240 },
    bandwidth_gb: 10000,
  },
  enterprise: {
    base_price: 799,
    org_seats: { owner: 10, collaborative: -1 },
    active_projects: -1,
    project_seats: { non_collaborative: 30, view_only: -1 },
    storage: { active_gb: 25600, archive_gb: 51200 },
    bandwidth_gb: 50000,
  },
};

const ADDON_PRICES = {
  owner_seat: 19,
  collaborative_seat: 14,
  non_collaborative_seat: 6,
  view_only_seat: 3,
  active_storage_100gb: 15,
  archive_storage_500gb: 12,
  bandwidth_500gb: 14,
  project: 14,
};

const PREMIUM_MODULES: Record<string, ModuleDef> = {
  budgeting: { name: 'Budgeting & Top Sheets', monthly: 29, annual_monthly: 24, available: ['pro'], included: ['business', 'enterprise'] },
  expenses: { name: 'Expense Tracking & Receipts', monthly: 29, annual_monthly: 24, available: ['pro'], included: ['business', 'enterprise'] },
  po_invoicing: { name: 'Purchase Orders & Invoicing', monthly: 39, annual_monthly: 33, available: ['business'], included: ['enterprise'] },
  timecards: { name: 'Timecards & Payroll', monthly: 39, annual_monthly: 33, available: ['business'], included: ['enterprise'] },
  dailies: { name: 'Dailies & Transcoding', monthly: 39, annual_monthly: 33, available: ['pro'], included: ['business', 'enterprise'] },
  continuity: { name: 'Continuity Tools', monthly: 29, annual_monthly: 24, available: ['pro'], included: ['business', 'enterprise'] },
  doc_signing: { name: 'Document Signing & Clearances', monthly: 29, annual_monthly: 24, available: ['business'], included: ['enterprise'] },
  custom_branding: { name: 'Custom Branding', monthly: 15, annual_monthly: 13, available: ['business'], included: ['enterprise'] },
};

const BUNDLE_PRICE = { monthly: 149, annual_monthly: 124 };

interface TierDef {
  base_price: number;
  org_seats: { owner: number; collaborative: number };
  active_projects: number;
  project_seats: { non_collaborative: number; view_only: number };
  storage: { active_gb: number; archive_gb: number };
  bandwidth_gb: number;
}

interface ModuleDef {
  name: string;
  monthly: number;
  annual_monthly: number;
  available: string[];
  included: string[];
}

export interface PlanConfig {
  plan_type: 'tier' | 'a_la_carte';
  tier_name?: string;
  term_type: 'monthly' | 'annual';
  config: {
    owner_seats: number;
    collaborative_seats: number;
    active_projects: number;
    non_collaborative_per_project: number;
    view_only_per_project: number;
    active_storage_gb: number;
    archive_storage_gb: number;
    bandwidth_gb: number;
    selected_modules: string[];
    use_bundle: boolean;
  };
  computed: {
    monthly_total: number;
    effective_monthly: number;
    annual_total?: number;
    annual_savings?: number;
    line_items: Array<{ label: string; total: number; category?: string }>;
  };
}

interface PlanConfiguratorProps {
  onConfigChange: (config: PlanConfig) => void;
  initialConfig?: Partial<PlanConfig>;
  showCTA?: boolean;
  ctaLabel?: string;
  onCTAClick?: () => void;
}

function computeVolumeDiscount(seatCount: number, seatCost: number) {
  if (seatCount >= 100) return { rate: 0.20, amount: Math.round(seatCost * 0.20 * 100) / 100 };
  if (seatCount >= 50) return { rate: 0.15, amount: Math.round(seatCost * 0.15 * 100) / 100 };
  if (seatCount >= 25) return { rate: 0.10, amount: Math.round(seatCost * 0.10 * 100) / 100 };
  if (seatCount >= 10) return { rate: 0.05, amount: Math.round(seatCost * 0.05 * 100) / 100 };
  return { rate: 0, amount: 0 };
}

const TIER_ICONS: Record<string, any> = { free: Star, indie: Rocket, pro: Zap, business: Building2, enterprise: Crown };

export default function PlanConfigurator({
  onConfigChange,
  initialConfig,
  showCTA = false,
  ctaLabel = 'Subscribe',
  onCTAClick,
}: PlanConfiguratorProps) {
  const [planType, setPlanType] = useState<'tier' | 'a_la_carte'>(initialConfig?.plan_type || 'tier');
  const [tierName, setTierName] = useState(initialConfig?.tier_name || 'pro');
  const [termType, setTermType] = useState<'monthly' | 'annual'>(initialConfig?.term_type || 'monthly');

  const defaultTier = TIERS[tierName] || TIERS.pro;
  const [ownerSeats, setOwnerSeats] = useState(initialConfig?.config?.owner_seats || defaultTier.org_seats.owner);
  const [collabSeats, setCollabSeats] = useState(initialConfig?.config?.collaborative_seats || Math.max(0, defaultTier.org_seats.collaborative));
  const [projects, setProjects] = useState(initialConfig?.config?.active_projects || Math.max(1, defaultTier.active_projects));
  const [ncPerProject, setNcPerProject] = useState(initialConfig?.config?.non_collaborative_per_project || Math.max(0, defaultTier.project_seats.non_collaborative));
  const [voPerProject, setVoPerProject] = useState(initialConfig?.config?.view_only_per_project || Math.max(0, defaultTier.project_seats.view_only));
  const [activeStorageGb, setActiveStorageGb] = useState(initialConfig?.config?.active_storage_gb || defaultTier.storage.active_gb);
  const [archiveStorageGb, setArchiveStorageGb] = useState(initialConfig?.config?.archive_storage_gb || defaultTier.storage.archive_gb);
  const [bandwidthGb, setBandwidthGb] = useState(initialConfig?.config?.bandwidth_gb || defaultTier.bandwidth_gb);
  const [selectedModules, setSelectedModules] = useState<string[]>(initialConfig?.config?.selected_modules || []);
  const [useBundle, setUseBundle] = useState(initialConfig?.config?.use_bundle || false);

  const selectTier = (name: string) => {
    setTierName(name);
    setPlanType('tier');
    const t = TIERS[name];
    setOwnerSeats(t.org_seats.owner);
    setCollabSeats(Math.max(0, t.org_seats.collaborative));
    setProjects(Math.max(1, t.active_projects));
    setNcPerProject(Math.max(0, t.project_seats.non_collaborative));
    setVoPerProject(Math.max(0, t.project_seats.view_only));
    setActiveStorageGb(t.storage.active_gb);
    setArchiveStorageGb(t.storage.archive_gb);
    setBandwidthGb(t.bandwidth_gb);
    setSelectedModules([]);
    setUseBundle(false);
  };

  const selectALaCarte = () => {
    setPlanType('a_la_carte');
    setOwnerSeats(Math.max(1, ownerSeats));
    setProjects(Math.max(1, projects));
  };

  const toggleModule = (key: string) => {
    if (useBundle) return;
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    );
  };

  const toggleBundle = () => {
    if (useBundle) {
      setUseBundle(false);
      setSelectedModules([]);
    } else {
      setUseBundle(true);
      setSelectedModules(Object.keys(PREMIUM_MODULES));
    }
  };

  // Get available modules for current tier
  const getAvailableModules = () => {
    if (planType === 'a_la_carte') return Object.entries(PREMIUM_MODULES);
    return Object.entries(PREMIUM_MODULES).filter(([, mod]) =>
      mod.available.includes(tierName) || mod.included.includes(tierName)
    );
  };

  // Compute price locally
  const computePrice = useCallback(() => {
    const lineItems: Array<{ label: string; total: number; category?: string }> = [];
    let subtotal = 0;
    const isAnnual = termType === 'annual';

    if (planType === 'tier') {
      const tier = TIERS[tierName];

      if (tier.base_price > 0) {
        lineItems.push({ label: `${tierName.charAt(0).toUpperCase() + tierName.slice(1)} base plan`, total: tier.base_price, category: 'base' });
        subtotal += tier.base_price;
      }

      // Extra seats
      const inclOwner = tier.org_seats.owner;
      const inclCollab = tier.org_seats.collaborative < 0 ? 999999 : tier.org_seats.collaborative;
      const inclNc = tier.project_seats.non_collaborative < 0 ? 999999 : tier.project_seats.non_collaborative;
      const inclVo = tier.project_seats.view_only < 0 ? 999999 : tier.project_seats.view_only;

      const extraOwner = Math.max(0, ownerSeats - inclOwner);
      const extraCollab = Math.max(0, collabSeats - inclCollab);
      const extraNcPer = Math.max(0, ncPerProject - inclNc);
      const extraVoPer = Math.max(0, voPerProject - inclVo);
      const totalNc = extraNcPer * projects;
      const totalVo = extraVoPer * projects;

      if (extraOwner > 0) { const c = extraOwner * ADDON_PRICES.owner_seat; lineItems.push({ label: `Owner seats (+${extraOwner})`, total: c, category: 'seats' }); subtotal += c; }
      if (extraCollab > 0) { const c = extraCollab * ADDON_PRICES.collaborative_seat; lineItems.push({ label: `Collaborative seats (+${extraCollab})`, total: c, category: 'seats' }); subtotal += c; }
      if (totalNc > 0) { const c = totalNc * ADDON_PRICES.non_collaborative_seat; lineItems.push({ label: `Non-Collab seats (+${totalNc})`, total: c, category: 'seats' }); subtotal += c; }
      if (totalVo > 0) { const c = totalVo * ADDON_PRICES.view_only_seat; lineItems.push({ label: `View Only seats (+${totalVo})`, total: c, category: 'seats' }); subtotal += c; }

      // Extra projects
      const inclProjects = tier.active_projects < 0 ? 999999 : tier.active_projects;
      const extraProjects = Math.max(0, projects - inclProjects);
      if (extraProjects > 0) { const c = extraProjects * ADDON_PRICES.project; lineItems.push({ label: `Extra projects (+${extraProjects})`, total: c, category: 'base' }); subtotal += c; }

      // Extra storage (100 GB blocks)
      const extraActiveGb = Math.max(0, activeStorageGb - tier.storage.active_gb);
      const activeBlocks = Math.ceil(extraActiveGb / 100);
      if (activeBlocks > 0) { const c = activeBlocks * ADDON_PRICES.active_storage_100gb; lineItems.push({ label: `Active storage (+${activeBlocks * 100} GB)`, total: c, category: 'storage' }); subtotal += c; }

      // Archive: 500 GB blocks
      const extraArchiveGb = Math.max(0, archiveStorageGb - tier.storage.archive_gb);
      const archiveBlocks = Math.ceil(extraArchiveGb / 500);
      if (archiveBlocks > 0) { const c = archiveBlocks * ADDON_PRICES.archive_storage_500gb; lineItems.push({ label: `Archive storage (+${archiveBlocks * 500} GB)`, total: c, category: 'storage' }); subtotal += c; }

      const extraBwGb = Math.max(0, bandwidthGb - tier.bandwidth_gb);
      const bwBlocks = Math.ceil(extraBwGb / 500);
      if (bwBlocks > 0) { const c = bwBlocks * ADDON_PRICES.bandwidth_500gb; lineItems.push({ label: `Bandwidth (+${bwBlocks * 500} GB)`, total: c, category: 'storage' }); subtotal += c; }

      // Modules
      if (useBundle) {
        const bundlePrice = isAnnual ? BUNDLE_PRICE.annual_monthly : BUNDLE_PRICE.monthly;
        lineItems.push({ label: 'Production Bundle', total: bundlePrice, category: 'modules' });
        subtotal += bundlePrice;
      } else {
        selectedModules.forEach(key => {
          const mod = PREMIUM_MODULES[key];
          if (!mod) return;
          if (mod.included.includes(tierName)) return; // already included
          if (!mod.available.includes(tierName)) return;
          const price = isAnnual ? mod.annual_monthly : mod.monthly;
          lineItems.push({ label: mod.name, total: price, category: 'modules' });
          subtotal += price;
        });
      }

      // Volume discount
      const totalAddedSeats = extraOwner + extraCollab + totalNc + totalVo;
      const totalSeatCost = (extraOwner * ADDON_PRICES.owner_seat) + (extraCollab * ADDON_PRICES.collaborative_seat) + (totalNc * ADDON_PRICES.non_collaborative_seat) + (totalVo * ADDON_PRICES.view_only_seat);
      const vol = computeVolumeDiscount(totalAddedSeats, totalSeatCost);
      if (vol.amount > 0) {
        lineItems.push({ label: `Volume discount (${Math.round(vol.rate * 100)}%)`, total: -vol.amount, category: 'discount' });
        subtotal -= vol.amount;
      }
    } else {
      // A la carte
      const oc = ownerSeats * ADDON_PRICES.owner_seat;
      lineItems.push({ label: `Owner seats (${ownerSeats})`, total: oc, category: 'seats' }); subtotal += oc;

      if (collabSeats > 0) { const c = collabSeats * ADDON_PRICES.collaborative_seat; lineItems.push({ label: `Collaborative seats (${collabSeats})`, total: c, category: 'seats' }); subtotal += c; }

      const pc = projects * ADDON_PRICES.project;
      lineItems.push({ label: `Active projects (${projects})`, total: pc, category: 'base' }); subtotal += pc;

      const totalNc = ncPerProject * projects;
      if (totalNc > 0) { const c = totalNc * ADDON_PRICES.non_collaborative_seat; lineItems.push({ label: `Non-Collab seats (${totalNc})`, total: c, category: 'seats' }); subtotal += c; }

      const totalVo = voPerProject * projects;
      if (totalVo > 0) { const c = totalVo * ADDON_PRICES.view_only_seat; lineItems.push({ label: `View Only seats (${totalVo})`, total: c, category: 'seats' }); subtotal += c; }

      if (activeStorageGb > 0) { const blocks = Math.ceil(activeStorageGb / 100); const c = blocks * ADDON_PRICES.active_storage_100gb; lineItems.push({ label: `Active storage (${blocks * 100} GB)`, total: c, category: 'storage' }); subtotal += c; }
      if (archiveStorageGb > 0) { const blocks = Math.ceil(archiveStorageGb / 500); const c = blocks * ADDON_PRICES.archive_storage_500gb; lineItems.push({ label: `Archive storage (${blocks * 500} GB)`, total: c, category: 'storage' }); subtotal += c; }
      if (bandwidthGb > 0) { const blocks = Math.ceil(bandwidthGb / 500); const c = blocks * ADDON_PRICES.bandwidth_500gb; lineItems.push({ label: `Bandwidth (${blocks * 500} GB)`, total: c, category: 'storage' }); subtotal += c; }

      // Modules in a la carte
      if (useBundle) {
        const bundlePrice = isAnnual ? BUNDLE_PRICE.annual_monthly : BUNDLE_PRICE.monthly;
        lineItems.push({ label: 'Production Bundle', total: bundlePrice, category: 'modules' });
        subtotal += bundlePrice;
      } else {
        selectedModules.forEach(key => {
          const mod = PREMIUM_MODULES[key];
          if (!mod) return;
          const price = isAnnual ? mod.annual_monthly : mod.monthly;
          lineItems.push({ label: mod.name, total: price, category: 'modules' });
          subtotal += price;
        });
      }

      // Volume discount for a la carte
      const totalSeats = ownerSeats + collabSeats + (ncPerProject * projects) + (voPerProject * projects);
      const totalSeatCost = (ownerSeats * ADDON_PRICES.owner_seat) + (collabSeats * ADDON_PRICES.collaborative_seat) + ((ncPerProject * projects) * ADDON_PRICES.non_collaborative_seat) + ((voPerProject * projects) * ADDON_PRICES.view_only_seat);
      const vol = computeVolumeDiscount(totalSeats, totalSeatCost);
      if (vol.amount > 0) {
        lineItems.push({ label: `Volume discount (${Math.round(vol.rate * 100)}%)`, total: -vol.amount, category: 'discount' });
        subtotal -= vol.amount;
      }
    }

    const monthlyTotal = Math.round(subtotal * 100) / 100;
    let effectiveMonthly = monthlyTotal;
    let annualTotal: number | undefined;
    let annualSavings: number | undefined;

    if (termType === 'annual' && monthlyTotal > 0) {
      annualTotal = monthlyTotal * 10;
      annualSavings = monthlyTotal * 2;
      effectiveMonthly = Math.round((annualTotal / 12) * 100) / 100;
    }

    return {
      plan_type: planType,
      tier_name: planType === 'tier' ? tierName : undefined,
      term_type: termType,
      config: {
        owner_seats: ownerSeats,
        collaborative_seats: collabSeats,
        active_projects: projects,
        non_collaborative_per_project: ncPerProject,
        view_only_per_project: voPerProject,
        active_storage_gb: activeStorageGb,
        archive_storage_gb: archiveStorageGb,
        bandwidth_gb: bandwidthGb,
        selected_modules: selectedModules,
        use_bundle: useBundle,
      },
      computed: { monthly_total: monthlyTotal, effective_monthly: effectiveMonthly, annual_total: annualTotal, annual_savings: annualSavings, line_items: lineItems },
    } as PlanConfig;
  }, [planType, tierName, termType, ownerSeats, collabSeats, projects, ncPerProject, voPerProject, activeStorageGb, archiveStorageGb, bandwidthGb, selectedModules, useBundle]);

  useEffect(() => {
    onConfigChange(computePrice());
  }, [computePrice, onConfigChange]);

  const tierEntries = Object.entries(TIERS) as [string, TierDef][];
  const availableModules = getAvailableModules();

  return (
    <div className="space-y-6">
      {/* Plan type selection */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {tierEntries.map(([name, tier]) => {
          const Icon = TIER_ICONS[name] || Star;
          return (
            <button
              key={name}
              onClick={() => selectTier(name)}
              className={`rounded-lg border p-3 text-left transition-all ${
                planType === 'tier' && tierName === name
                  ? 'border-accent-yellow bg-accent-yellow/10'
                  : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3 w-3 text-accent-yellow" />
                <span className="text-xs font-medium text-bone-white capitalize">{name}</span>
              </div>
              <div className="text-sm font-bold text-accent-yellow">
                {tier.base_price === 0 ? 'Free' : `$${tier.base_price}`}
                {tier.base_price > 0 && <span className="text-[10px] text-muted-gray">/mo</span>}
              </div>
              {name === 'pro' && <Badge className="mt-1 bg-accent-yellow/20 text-accent-yellow border-0 text-[9px] px-1.5 py-0">Popular</Badge>}
            </button>
          );
        })}
        <button
          onClick={selectALaCarte}
          className={`rounded-lg border p-3 text-left transition-all ${
            planType === 'a_la_carte'
              ? 'border-accent-yellow bg-accent-yellow/10'
              : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]'
          }`}
        >
          <div className="text-xs font-medium text-bone-white">Build Your Own</div>
          <div className="text-sm font-bold text-accent-yellow">$33+<span className="text-[10px] text-muted-gray">/mo</span></div>
          <Badge className="mt-1 bg-accent-yellow/20 text-accent-yellow border-0 text-[9px] px-1.5 py-0">A La Carte</Badge>
        </button>
      </div>

      {/* Billing toggle */}
      {(planType !== 'tier' || tierName !== 'free') && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
          <span className={`text-sm ${termType === 'monthly' ? 'text-bone-white' : 'text-muted-gray'}`}>Monthly</span>
          <Switch checked={termType === 'annual'} onCheckedChange={(checked) => setTermType(checked ? 'annual' : 'monthly')} />
          <span className={`text-sm ${termType === 'annual' ? 'text-bone-white' : 'text-muted-gray'}`}>Annual</span>
          {termType === 'annual' && <Badge className="bg-green-900/40 text-green-400 border-0 text-xs">Save ~17%</Badge>}
        </div>
      )}

      {/* Resource sliders */}
      {(planType !== 'tier' || tierName !== 'free') && (
        <div className="space-y-5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-5">
          <h3 className="text-sm font-semibold text-bone-white uppercase tracking-wide">Seats</h3>
          <SliderField label="Owner Seats" value={ownerSeats} onChange={setOwnerSeats} min={1} max={10} price={ADDON_PRICES.owner_seat} unit="/seat" />
          <SliderField label="Collaborative Seats" value={collabSeats} onChange={setCollabSeats} min={0} max={100} price={ADDON_PRICES.collaborative_seat} unit="/seat" />

          <h3 className="text-sm font-semibold text-bone-white uppercase tracking-wide pt-2">Projects</h3>
          <SliderField label="Active Projects" value={projects} onChange={setProjects} min={1} max={50} price={ADDON_PRICES.project} unit="/project" />

          <h3 className="text-sm font-semibold text-bone-white uppercase tracking-wide pt-2">Per-Project Seats</h3>
          <SliderField label="Non-Collaborative / Project" value={ncPerProject} onChange={setNcPerProject} min={0} max={30} price={ADDON_PRICES.non_collaborative_seat} unit="/seat" />
          <SliderField label="View Only / Project" value={voPerProject} onChange={setVoPerProject} min={0} max={50} price={ADDON_PRICES.view_only_seat} unit="/seat" />

          <h3 className="text-sm font-semibold text-bone-white uppercase tracking-wide pt-2">Storage & Bandwidth</h3>
          <SliderField label="Active Storage (GB)" value={activeStorageGb} onChange={setActiveStorageGb} min={0} max={10240} step={100} price={ADDON_PRICES.active_storage_100gb} unit="/100GB" />
          <SliderField label="Archive Storage (GB)" value={archiveStorageGb} onChange={setArchiveStorageGb} min={0} max={25600} step={500} price={ADDON_PRICES.archive_storage_500gb} unit="/500GB" />
          <SliderField label="Bandwidth (GB)" value={bandwidthGb} onChange={setBandwidthGb} min={0} max={25000} step={500} price={ADDON_PRICES.bandwidth_500gb} unit="/500GB" />
        </div>
      )}

      {/* Premium Modules */}
      {availableModules.length > 0 && (planType !== 'tier' || tierName !== 'free') && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-bone-white uppercase tracking-wide">Premium Modules</h3>
          </div>

          {/* Production Bundle toggle */}
          <button
            onClick={toggleBundle}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
              useBundle
                ? 'border-accent-yellow bg-accent-yellow/10'
                : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
            }`}
          >
            <Package className="h-4 w-4 text-accent-yellow flex-shrink-0" />
            <div className="text-left flex-1">
              <div className="text-sm font-medium text-bone-white">Production Bundle</div>
              <div className="text-xs text-muted-gray">All modules — save vs. individual pricing</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-accent-yellow">
                ${termType === 'annual' ? BUNDLE_PRICE.annual_monthly : BUNDLE_PRICE.monthly}/mo
              </div>
            </div>
            <Checkbox checked={useBundle} className="flex-shrink-0" />
          </button>

          {/* Individual modules */}
          {!useBundle && (
            <div className="space-y-2">
              {availableModules.map(([key, mod]) => {
                const isIncluded = planType === 'tier' && mod.included.includes(tierName);
                const isSelected = selectedModules.includes(key);
                const price = termType === 'annual' ? mod.annual_monthly : mod.monthly;

                return (
                  <button
                    key={key}
                    onClick={() => !isIncluded && toggleModule(key)}
                    disabled={isIncluded}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                      isIncluded
                        ? 'border-green-800/30 bg-green-900/10'
                        : isSelected
                          ? 'border-accent-yellow bg-accent-yellow/5'
                          : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                    }`}
                  >
                    <div className="text-left flex-1">
                      <span className="text-sm text-bone-white/80">{mod.name}</span>
                    </div>
                    {isIncluded ? (
                      <Badge className="bg-green-900/40 text-green-400 border-0 text-[10px]">Included</Badge>
                    ) : (
                      <>
                        <span className="text-xs text-accent-yellow">${price}/mo</span>
                        <Checkbox checked={isSelected} className="flex-shrink-0" />
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showCTA && onCTAClick && (
        <Button className="w-full bg-accent-yellow text-charcoal-black hover:bg-yellow-400 font-semibold h-12 text-base" onClick={onCTAClick}>
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}

function SliderField({ label, value, onChange, min, max, step = 1, price, unit }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
  price?: number; unit?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm text-bone-white/80">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-accent-yellow">{value.toLocaleString()}</span>
          {price && <span className="text-xs text-muted-gray">(${price}{unit})</span>}
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );
}
