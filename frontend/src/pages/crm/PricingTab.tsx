import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useQuotesList, useCreateQuote, useUpdateQuoteStatus, useComputeQuote,
} from '@/hooks/crm/usePricing';
import { useContacts } from '@/hooks/crm/useContacts';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DollarSign, Plus, FileText, Copy, ChevronRight, ChevronLeft, Check,
  Loader2, Send, X, Eye, Search, Calculator, Users, HardDrive, Zap,
  BarChart3, Award, ClipboardList,
} from 'lucide-react';

// =============================================================================
// Pricing Constants (mirror of backend)
// =============================================================================

const TIERS = {
  starter: {
    base_price: 1000, label: 'Starter',
    org_seats: { owner: 1, collaborative: 2 },
    active_projects: 5,
    project_seats: { non_collaborative: 3, view_only: 3 },
    storage: { active_tb: 1, archive_tb: 2 },
    bandwidth_gb: 500,
  },
  studio: {
    base_price: 4000, label: 'Studio',
    org_seats: { owner: 1, collaborative: 14 },
    active_projects: 15,
    project_seats: { non_collaborative: 6, view_only: 10 },
    storage: { active_tb: 3, archive_tb: 8 },
    bandwidth_gb: 2000,
  },
  enterprise: {
    base_price: 8000, label: 'Enterprise',
    org_seats: { owner: 2, collaborative: 28 },
    active_projects: 30,
    project_seats: { non_collaborative: 10, view_only: 20 },
    storage: { active_tb: 6, archive_tb: 20 },
    bandwidth_gb: 5000,
  },
};

const ADDON = { owner: 150, collaborative: 75, non_collaborative: 25, view_only: 5, active_tb: 200, archive_2tb: 150, bw_500gb: 150 };

type TierKey = keyof typeof TIERS;

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtD(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }); }

// Local pricing calc for real-time preview
function calcLocal(w: WizardState) {
  const t = TIERS[w.tier];
  const base = t.base_price;

  const exOwner = Math.max(0, w.requiredOwnerSeats - t.org_seats.owner);
  const exCollab = Math.max(0, w.requiredCollaborativeSeats - t.org_seats.collaborative);
  const exNcPer = Math.max(0, w.requiredNonCollaborativePerProject - t.project_seats.non_collaborative);
  const exVoPer = Math.max(0, w.requiredViewOnlyPerProject - t.project_seats.view_only);
  const totalExNc = exNcPer * w.activeProjects;
  const totalExVo = exVoPer * w.activeProjects;
  const totalAddedSeats = exOwner + exCollab + totalExNc + totalExVo;

  const seatCost = exOwner * ADDON.owner + exCollab * ADDON.collaborative + totalExNc * ADDON.non_collaborative + totalExVo * ADDON.view_only;

  const exActiveTb = Math.max(0, w.requiredActiveStorageTB - t.storage.active_tb);
  const activeBlocks = Math.ceil(exActiveTb);
  const exArchiveTb = Math.max(0, w.requiredArchiveStorageTB - t.storage.archive_tb);
  const archiveBlocks = Math.ceil(exArchiveTb / 2);
  const exBwGb = Math.max(0, w.requiredBandwidthGB - t.bandwidth_gb);
  const bwBlocks = Math.ceil(exBwGb / 500);
  const storageCost = activeBlocks * ADDON.active_tb + archiveBlocks * ADDON.archive_2tb + bwBlocks * ADDON.bw_500gb;

  let discountRate = 0;
  let discountBand = 'none';
  if (totalAddedSeats >= 50) { discountRate = 0.15; discountBand = '15%'; }
  else if (totalAddedSeats >= 25) { discountRate = 0.10; discountBand = '10%'; }
  else if (totalAddedSeats >= 10) { discountRate = 0.05; discountBand = '5%'; }
  const volumeDiscount = Math.round(seatCost * discountRate * 100) / 100;

  let bugDiscount = 0;
  if (w.bugReward === '50_percent') bugDiscount = base * 0.5;
  else if (w.bugReward === '100_percent') bugDiscount = base;

  const subtotal = base + seatCost + storageCost;
  const monthlyTotal = Math.round((subtotal - volumeDiscount - bugDiscount) * 100) / 100;

  let contractValue = monthlyTotal * w.termMonths;
  let effectiveMonthly = monthlyTotal;
  let annualSavings = 0;
  if (w.termType === 'annual') {
    contractValue = monthlyTotal * 10;
    effectiveMonthly = Math.round(contractValue / 12 * 100) / 100;
    annualSavings = monthlyTotal * 2;
  }

  return {
    base, seatCost, storageCost, volumeDiscount, bugDiscount, discountBand,
    totalAddedSeats, subtotal, monthlyTotal, contractValue, effectiveMonthly, annualSavings,
    exOwner, exCollab, totalExNc, totalExVo, exNcPer, exVoPer,
    activeBlocks, archiveBlocks, bwBlocks,
  };
}

// =============================================================================
// Wizard State
// =============================================================================

interface PhaseState {
  name: string; months: number;
  activeProjects: number;
  requiredOwnerSeats: number; requiredCollaborativeSeats: number;
  requiredNonCollaborativePerProject: number; requiredViewOnlyPerProject: number;
  requiredActiveStorageTB: number; requiredArchiveStorageTB: number; requiredBandwidthGB: number;
}

interface WizardState {
  step: number;
  clientName: string; region: string; productionType: string;
  startDate: string; endDate: string;
  termType: 'monthly' | 'annual'; termMonths: number;
  trialType: 'none' | '7day' | '30day';
  tier: TierKey;
  requiredOwnerSeats: number; requiredCollaborativeSeats: number;
  activeProjects: number;
  requiredNonCollaborativePerProject: number; requiredViewOnlyPerProject: number;
  requiredActiveStorageTB: number; requiredArchiveStorageTB: number; requiredBandwidthGB: number;
  isProductionPackage: boolean; phases: PhaseState[];
  bugReward: 'none' | '50_percent' | '100_percent';
  linkedContactId: string; notes: string;
}

const DEFAULT_WIZARD: WizardState = {
  step: 0, clientName: '', region: '', productionType: '',
  startDate: '', endDate: '', termType: 'monthly', termMonths: 3, trialType: 'none',
  tier: 'starter',
  requiredOwnerSeats: 1, requiredCollaborativeSeats: 2, activeProjects: 5,
  requiredNonCollaborativePerProject: 3, requiredViewOnlyPerProject: 3,
  requiredActiveStorageTB: 1, requiredArchiveStorageTB: 2, requiredBandwidthGB: 500,
  isProductionPackage: false,
  phases: [
    { name: 'Pre-Production', months: 2, activeProjects: 3, requiredOwnerSeats: 1, requiredCollaborativeSeats: 2, requiredNonCollaborativePerProject: 3, requiredViewOnlyPerProject: 3, requiredActiveStorageTB: 1, requiredArchiveStorageTB: 2, requiredBandwidthGB: 500 },
    { name: 'Production', months: 3, activeProjects: 5, requiredOwnerSeats: 1, requiredCollaborativeSeats: 5, requiredNonCollaborativePerProject: 5, requiredViewOnlyPerProject: 5, requiredActiveStorageTB: 2, requiredArchiveStorageTB: 3, requiredBandwidthGB: 1500 },
    { name: 'Post-Production', months: 2, activeProjects: 3, requiredOwnerSeats: 1, requiredCollaborativeSeats: 3, requiredNonCollaborativePerProject: 3, requiredViewOnlyPerProject: 3, requiredActiveStorageTB: 1, requiredArchiveStorageTB: 4, requiredBandwidthGB: 500 },
  ],
  bugReward: 'none', linkedContactId: '', notes: '',
};

const STEPS = ['Client & Basics', 'Choose Tier', 'Seats & Projects', 'Storage & Bandwidth', 'Phased Package', 'Discounts', 'Summary'];

// =============================================================================
// Step Components
// =============================================================================

function StepClientInfo({ w, set }: { w: WizardState; set: (u: Partial<WizardState>) => void }) {
  const { data: contactsData } = useContacts({ limit: 200 });
  const contacts = contactsData?.contacts || [];

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label>Client / Company Name *</Label>
        <Input value={w.clientName} onChange={e => set({ clientName: e.target.value })} placeholder="Acme Productions" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Region</Label>
          <Select value={w.region} onValueChange={v => set({ region: v })}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="ca">Canada</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
              <SelectItem value="au">Australia</SelectItem>
              <SelectItem value="eu">Europe</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Production Type</Label>
          <Select value={w.productionType} onValueChange={v => set({ productionType: v })}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="series">Series</SelectItem>
              <SelectItem value="feature">Feature Film</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="short">Short Film</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Expected Start</Label>
          <Input type="date" value={w.startDate} onChange={e => set({ startDate: e.target.value })} />
        </div>
        <div>
          <Label>Expected End</Label>
          <Input type="date" value={w.endDate} onChange={e => set({ endDate: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Term</Label>
          <Select value={w.termType} onValueChange={(v: any) => set({ termType: v, termMonths: v === 'annual' ? 12 : Math.max(w.termMonths, 3) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annual">Annual Prepay (2 months free)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {w.termType === 'monthly' && (
          <div>
            <Label>Term Length (months, min 3)</Label>
            <Input type="number" min={3} value={w.termMonths} onChange={e => set({ termMonths: Math.max(3, parseInt(e.target.value) || 3) })} />
          </div>
        )}
      </div>
      <div>
        <Label>Trial</Label>
        <Select value={w.trialType} onValueChange={(v: any) => set({ trialType: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No trial — paid start</SelectItem>
            <SelectItem value="7day">7-day trial (full features, card required)</SelectItem>
            <SelectItem value="30day">30-day trial (full features, card required)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-gray mt-1">Offer 7-day first; if not ready, offer 30-day.</p>
      </div>
      <div>
        <Label>Link to Contact (optional)</Label>
        <Select value={w.linkedContactId || 'none'} onValueChange={v => set({ linkedContactId: v === 'none' ? '' : v })}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {contacts.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.company ? `(${c.company})` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function TierCard({ tierKey, tier, selected, onSelect }: { tierKey: string; tier: any; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`text-left p-4 rounded-lg border-2 transition-all ${
        selected ? 'border-accent-yellow bg-accent-yellow/5' : 'border-muted-gray/20 hover:border-muted-gray/40'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-heading text-bone-white">{tier.label}</h3>
        <span className="text-xl font-bold text-accent-yellow">{fmt(tier.base_price)}<span className="text-xs text-muted-gray">/mo</span></span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-gray">
        <span>{tier.org_seats.owner} Owner + {tier.org_seats.collaborative} Collab seats</span>
        <span>{tier.active_projects} active projects</span>
        <span>{tier.project_seats.non_collaborative} Non-Collab + {tier.project_seats.view_only} View/proj</span>
        <span>{tier.storage.active_tb} TB active + {tier.storage.archive_tb} TB archive</span>
        <span>{tier.bandwidth_gb >= 1000 ? `${tier.bandwidth_gb / 1000} TB` : `${tier.bandwidth_gb} GB`} bandwidth</span>
      </div>
      {selected && <div className="mt-2 flex items-center gap-1 text-accent-yellow text-xs font-medium"><Check className="h-3 w-3" /> Selected</div>}
    </button>
  );
}

function StepTier({ w, set }: { w: WizardState; set: (u: Partial<WizardState>) => void }) {
  const handleSelect = (tierKey: TierKey) => {
    const t = TIERS[tierKey];
    set({
      tier: tierKey,
      requiredOwnerSeats: t.org_seats.owner,
      requiredCollaborativeSeats: t.org_seats.collaborative,
      activeProjects: t.active_projects,
      requiredNonCollaborativePerProject: t.project_seats.non_collaborative,
      requiredViewOnlyPerProject: t.project_seats.view_only,
      requiredActiveStorageTB: t.storage.active_tb,
      requiredArchiveStorageTB: t.storage.archive_tb,
      requiredBandwidthGB: t.bandwidth_gb,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {(Object.entries(TIERS) as [TierKey, any][]).map(([key, tier]) => (
        <TierCard key={key} tierKey={key} tier={tier} selected={w.tier === key} onSelect={() => handleSelect(key)} />
      ))}
    </div>
  );
}

function SeatRow({ label, included, required, extra, unitPrice, totalCost, onChangeRequired }: {
  label: string; included: number; required: number; extra: number; unitPrice: number; totalCost: number;
  onChangeRequired: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-3 items-center text-sm py-2 border-b border-muted-gray/10">
      <span className="text-bone-white font-medium col-span-2">{label}</span>
      <span className="text-center text-muted-gray">{included}</span>
      <div className="text-center">
        <Input type="number" min={0} className="w-20 mx-auto text-center h-8" value={required} onChange={e => onChangeRequired(parseInt(e.target.value) || 0)} />
      </div>
      <span className={`text-center ${extra > 0 ? 'text-amber-400' : 'text-green-400'}`}>{extra > 0 ? `+${extra}` : '—'}</span>
      <span className="text-right text-bone-white">{totalCost > 0 ? fmt(totalCost) : '—'}</span>
    </div>
  );
}

function StepSeatsProjects({ w, set, calc }: { w: WizardState; set: (u: Partial<WizardState>) => void; calc: ReturnType<typeof calcLocal> }) {
  const t = TIERS[w.tier];

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <Label>Active Projects</Label>
        <div className="flex items-center gap-3 mt-1">
          <Input type="number" min={1} className="w-24" value={w.activeProjects} onChange={e => set({ activeProjects: parseInt(e.target.value) || 1 })} />
          <span className="text-xs text-muted-gray">Included: {t.active_projects}</span>
          {w.activeProjects > t.active_projects && (
            <span className="text-xs text-amber-400">Consider upgrading tier for more projects</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3 text-xs text-muted-gray font-medium border-b border-muted-gray/20 pb-2">
        <span className="col-span-2">Seat Type</span>
        <span className="text-center">Included</span>
        <span className="text-center">Required</span>
        <span className="text-center">Extra</span>
        <span className="text-right">Cost/mo</span>
      </div>

      <div className="text-xs text-muted-gray font-medium mt-2 mb-1">Org Seats (named users)</div>
      <SeatRow label="Owner" included={t.org_seats.owner} required={w.requiredOwnerSeats} extra={calc.exOwner} unitPrice={ADDON.owner} totalCost={calc.exOwner * ADDON.owner} onChangeRequired={v => set({ requiredOwnerSeats: v })} />
      <SeatRow label="Collaborative" included={t.org_seats.collaborative} required={w.requiredCollaborativeSeats} extra={calc.exCollab} unitPrice={ADDON.collaborative} totalCost={calc.exCollab * ADDON.collaborative} onChangeRequired={v => set({ requiredCollaborativeSeats: v })} />

      <div className="text-xs text-muted-gray font-medium mt-4 mb-1">Project Seats (per active project × {w.activeProjects} projects)</div>
      <SeatRow
        label="Non-Collaborative"
        included={t.project_seats.non_collaborative}
        required={w.requiredNonCollaborativePerProject}
        extra={calc.totalExNc}
        unitPrice={ADDON.non_collaborative}
        totalCost={calc.totalExNc * ADDON.non_collaborative}
        onChangeRequired={v => set({ requiredNonCollaborativePerProject: v })}
      />
      <p className="text-xs text-muted-gray/60 ml-2 -mt-1">
        +{calc.exNcPer}/proj × {w.activeProjects} proj = {calc.totalExNc} extra seats × {fmt(ADDON.non_collaborative)}/seat
      </p>
      <SeatRow
        label="View Only"
        included={t.project_seats.view_only}
        required={w.requiredViewOnlyPerProject}
        extra={calc.totalExVo}
        unitPrice={ADDON.view_only}
        totalCost={calc.totalExVo * ADDON.view_only}
        onChangeRequired={v => set({ requiredViewOnlyPerProject: v })}
      />

      <div className="mt-4 p-3 rounded-lg bg-muted-gray/10 flex items-center justify-between">
        <div>
          <span className="text-sm text-bone-white">Added seats subtotal</span>
          <span className="text-xs text-muted-gray ml-2">({calc.totalAddedSeats} added seats)</span>
        </div>
        <div className="text-right">
          <span className="text-bone-white font-medium">{fmt(calc.seatCost)}/mo</span>
          {calc.discountBand !== 'none' && (
            <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/30 text-xs">-{calc.discountBand} volume</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function StepStorageBandwidth({ w, set, calc }: { w: WizardState; set: (u: Partial<WizardState>) => void; calc: ReturnType<typeof calcLocal> }) {
  const t = TIERS[w.tier];

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Label>Active Storage (TB)</Label>
        <div className="flex items-center gap-3 mt-1">
          <Input type="number" min={0} step={0.5} className="w-24" value={w.requiredActiveStorageTB} onChange={e => set({ requiredActiveStorageTB: parseFloat(e.target.value) || 0 })} />
          <span className="text-xs text-muted-gray">Included: {t.storage.active_tb} TB</span>
        </div>
        {calc.activeBlocks > 0 && (
          <p className="text-xs text-amber-400 mt-1">+{calc.activeBlocks} TB block(s) = {fmt(calc.activeBlocks * ADDON.active_tb)}/mo</p>
        )}
      </div>
      <div>
        <Label>Archive Storage (TB)</Label>
        <div className="flex items-center gap-3 mt-1">
          <Input type="number" min={0} step={1} className="w-24" value={w.requiredArchiveStorageTB} onChange={e => set({ requiredArchiveStorageTB: parseFloat(e.target.value) || 0 })} />
          <span className="text-xs text-muted-gray">Included: {t.storage.archive_tb} TB (2 TB blocks @ {fmt(ADDON.archive_2tb)}/block)</span>
        </div>
        {calc.archiveBlocks > 0 && (
          <p className="text-xs text-amber-400 mt-1">+{calc.archiveBlocks} block(s) ({calc.archiveBlocks * 2} TB) = {fmt(calc.archiveBlocks * ADDON.archive_2tb)}/mo</p>
        )}
      </div>
      <div>
        <Label>Monthly Bandwidth (GB)</Label>
        <div className="flex items-center gap-3 mt-1">
          <Input type="number" min={0} step={100} className="w-24" value={w.requiredBandwidthGB} onChange={e => set({ requiredBandwidthGB: parseFloat(e.target.value) || 0 })} />
          <span className="text-xs text-muted-gray">Included: {t.bandwidth_gb >= 1000 ? `${t.bandwidth_gb / 1000} TB` : `${t.bandwidth_gb} GB`} (500 GB blocks @ {fmt(ADDON.bw_500gb)}/block)</span>
        </div>
        {calc.bwBlocks > 0 && (
          <p className="text-xs text-amber-400 mt-1">+{calc.bwBlocks} block(s) ({calc.bwBlocks * 500} GB) = {fmt(calc.bwBlocks * ADDON.bw_500gb)}/mo</p>
        )}
      </div>
      <div className="p-3 rounded-lg bg-muted-gray/10 flex items-center justify-between">
        <span className="text-sm text-bone-white">Storage & bandwidth subtotal</span>
        <span className="text-bone-white font-medium">{fmt(calc.storageCost)}/mo</span>
      </div>
    </div>
  );
}

function StepPhases({ w, set }: { w: WizardState; set: (u: Partial<WizardState>) => void }) {
  const updatePhase = (idx: number, updates: Partial<PhaseState>) => {
    const phases = [...w.phases];
    phases[idx] = { ...phases[idx], ...updates };
    set({ phases });
  };

  const addPhase = () => {
    set({ phases: [...w.phases, { name: `Phase ${w.phases.length + 1}`, months: 1, activeProjects: TIERS[w.tier].active_projects, requiredOwnerSeats: TIERS[w.tier].org_seats.owner, requiredCollaborativeSeats: TIERS[w.tier].org_seats.collaborative, requiredNonCollaborativePerProject: TIERS[w.tier].project_seats.non_collaborative, requiredViewOnlyPerProject: TIERS[w.tier].project_seats.view_only, requiredActiveStorageTB: TIERS[w.tier].storage.active_tb, requiredArchiveStorageTB: TIERS[w.tier].storage.archive_tb, requiredBandwidthGB: TIERS[w.tier].bandwidth_gb }] });
  };

  const removePhase = (idx: number) => {
    set({ phases: w.phases.filter((_, i) => i !== idx) });
  };

  if (!w.isProductionPackage) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="flex items-center gap-3">
          <Switch checked={w.isProductionPackage} onCheckedChange={v => set({ isProductionPackage: v })} />
          <Label>Enable production package (phase-based quoting)</Label>
        </div>
        <p className="text-sm text-muted-gray">Enable this to quote month-by-month by production phase (Pre, Production, Post) with different resource requirements per phase.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch checked={w.isProductionPackage} onCheckedChange={v => set({ isProductionPackage: v })} />
          <Label>Production Package</Label>
        </div>
        <Button size="sm" variant="outline" onClick={addPhase}><Plus className="h-3.5 w-3.5 mr-1" /> Add Phase</Button>
      </div>

      <div className="space-y-3">
        {w.phases.map((phase, idx) => {
          const phaseW = { ...w, ...phase } as WizardState;
          const phaseCalc = calcLocal(phaseW);
          return (
            <div key={idx} className="border border-muted-gray/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <Input className="w-48 font-medium" value={phase.name} onChange={e => updatePhase(idx, { name: e.target.value })} />
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Months:</Label>
                  <Input type="number" min={1} className="w-16 h-8" value={phase.months} onChange={e => updatePhase(idx, { months: parseInt(e.target.value) || 1 })} />
                  <span className="text-sm font-medium text-accent-yellow">{fmt(phaseCalc.monthlyTotal)}/mo</span>
                  {w.phases.length > 1 && (
                    <Button variant="ghost" size="sm" className="text-red-400" onClick={() => removePhase(idx)}><X className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                <div>
                  <Label className="text-xs">Projects</Label>
                  <Input type="number" min={1} className="h-7 text-xs" value={phase.activeProjects} onChange={e => updatePhase(idx, { activeProjects: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label className="text-xs">Collab seats</Label>
                  <Input type="number" min={0} className="h-7 text-xs" value={phase.requiredCollaborativeSeats} onChange={e => updatePhase(idx, { requiredCollaborativeSeats: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">NC/proj</Label>
                  <Input type="number" min={0} className="h-7 text-xs" value={phase.requiredNonCollaborativePerProject} onChange={e => updatePhase(idx, { requiredNonCollaborativePerProject: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Storage TB</Label>
                  <Input type="number" min={0} step={0.5} className="h-7 text-xs" value={phase.requiredActiveStorageTB} onChange={e => updatePhase(idx, { requiredActiveStorageTB: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">BW (GB)</Label>
                  <Input type="number" min={0} step={100} className="h-7 text-xs" value={phase.requiredBandwidthGB} onChange={e => updatePhase(idx, { requiredBandwidthGB: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded-lg bg-accent-yellow/10 border border-accent-yellow/20">
        <div className="flex justify-between text-sm">
          <span className="text-bone-white">Total months: {w.phases.reduce((s, p) => s + p.months, 0)}</span>
          <span className="text-accent-yellow font-medium">
            Package total: {fmt(w.phases.reduce((s, p) => {
              const pc = calcLocal({ ...w, ...p } as WizardState);
              return s + pc.monthlyTotal * p.months;
            }, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

function StepDiscounts({ w, set, calc }: { w: WizardState; set: (u: Partial<WizardState>) => void; calc: ReturnType<typeof calcLocal> }) {
  return (
    <div className="space-y-6 max-w-lg">
      <div className="p-4 rounded-lg border border-muted-gray/20">
        <h3 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Volume Discount</h3>
        <p className="text-xs text-muted-gray mb-2">Auto-computed based on total added seats. Applied to added seats subtotal only.</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-gray">{calc.totalAddedSeats} added seats → {calc.discountBand === 'none' ? 'no discount' : calc.discountBand + ' discount'}</span>
          {calc.volumeDiscount > 0 && <span className="text-green-400 font-medium">-{fmt(calc.volumeDiscount)}/mo</span>}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-center">
          {[{ min: 10, max: 24, pct: '5%' }, { min: 25, max: 49, pct: '10%' }, { min: 50, max: null, pct: '15%' }].map(band => (
            <div key={band.pct} className={`p-1.5 rounded ${calc.totalAddedSeats >= band.min && (band.max === null || calc.totalAddedSeats <= band.max) ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-muted-gray/10 text-muted-gray'}`}>
              {band.min}{band.max ? `-${band.max}` : '+'}: {band.pct}
            </div>
          ))}
        </div>
      </div>

      {w.termType === 'annual' && (
        <div className="p-4 rounded-lg border border-muted-gray/20">
          <h3 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Annual Prepay Savings</h3>
          <p className="text-xs text-muted-gray mb-2">Pay for 10 months, get 12 months of service. Applied to full monthly total.</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-gray">2 months free</span>
            <span className="text-green-400 font-medium">-{fmt(calc.annualSavings)} saved</span>
          </div>
        </div>
      )}

      <div className="p-4 rounded-lg border border-muted-gray/20">
        <h3 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2"><Award className="h-4 w-4" /> Bug Reward</h3>
        <p className="text-xs text-muted-gray mb-2">Applies to base tier price only ({fmt(calc.base)}), for a specific billing month. Paid customers only.</p>
        <Select value={w.bugReward} onValueChange={(v: any) => set({ bugReward: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No bug reward applied</SelectItem>
            <SelectItem value="50_percent">50% off base next month (-{fmt(calc.base * 0.5)})</SelectItem>
            <SelectItem value="100_percent">Free base month (-{fmt(calc.base)})</SelectItem>
          </SelectContent>
        </Select>
        {calc.bugDiscount > 0 && <p className="text-xs text-green-400 mt-2">Saves {fmt(calc.bugDiscount)} on the applied month's base price.</p>}
      </div>
    </div>
  );
}

function StepSummary({ w, calc, onSave, saving }: { w: WizardState; calc: ReturnType<typeof calcLocal>; onSave: () => void; saving: boolean }) {
  const t = TIERS[w.tier];
  const [copied, setCopied] = useState(false);

  const summaryText = useMemo(() => {
    const lines = [
      `BACKLOT QUOTE — ${w.clientName || 'Unnamed'}`,
      '='.repeat(50),
      `Tier: ${t.label} | Term: ${w.termType === 'annual' ? 'Annual' : `${w.termMonths}-month`}`,
      w.trialType !== 'none' ? `Trial: ${w.trialType.replace('day', '-day')}` : '',
      '',
      `Base plan: ${fmt(calc.base)}/mo`,
      calc.seatCost > 0 ? `Added seats (${calc.totalAddedSeats}): ${fmt(calc.seatCost)}/mo` : '',
      calc.storageCost > 0 ? `Storage & bandwidth: ${fmt(calc.storageCost)}/mo` : '',
      calc.volumeDiscount > 0 ? `Volume discount (${calc.discountBand}): -${fmt(calc.volumeDiscount)}/mo` : '',
      calc.bugDiscount > 0 ? `Bug reward: -${fmt(calc.bugDiscount)}` : '',
      '',
      `Monthly Total: ${fmt(calc.monthlyTotal)}`,
      `Contract Value: ${fmt(calc.contractValue)}`,
      w.termType === 'annual' ? `Effective Monthly: ${fmtD(calc.effectiveMonthly)}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  }, [w, calc]);

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-bone-white">Quote Breakdown</h3>
          <div className="p-4 rounded-lg border border-muted-gray/20 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-gray">{t.label} base plan</span><span className="text-bone-white">{fmt(calc.base)}</span></div>
            {calc.seatCost > 0 && <div className="flex justify-between"><span className="text-muted-gray">Added seats ({calc.totalAddedSeats})</span><span className="text-bone-white">{fmt(calc.seatCost)}</span></div>}
            {calc.storageCost > 0 && <div className="flex justify-between"><span className="text-muted-gray">Storage & bandwidth</span><span className="text-bone-white">{fmt(calc.storageCost)}</span></div>}
            <div className="border-t border-muted-gray/20 pt-2 flex justify-between"><span className="text-muted-gray">Subtotal</span><span className="text-bone-white">{fmt(calc.subtotal)}</span></div>
            {calc.volumeDiscount > 0 && <div className="flex justify-between text-green-400"><span>Volume discount ({calc.discountBand})</span><span>-{fmt(calc.volumeDiscount)}</span></div>}
            {calc.bugDiscount > 0 && <div className="flex justify-between text-green-400"><span>Bug reward</span><span>-{fmt(calc.bugDiscount)}</span></div>}
            <div className="border-t border-muted-gray/20 pt-2 flex justify-between text-base font-medium">
              <span className="text-bone-white">Monthly Total</span>
              <span className="text-accent-yellow">{fmt(calc.monthlyTotal)}</span>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea className="mt-1" rows={3} value={w.notes} onChange={e => set({ notes: e.target.value })} placeholder="Additional notes or assumptions..." />
          </div>
        </div>

        {/* Right: totals */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-bone-white">Contract Summary</h3>
          <div className="p-4 rounded-lg bg-accent-yellow/5 border border-accent-yellow/20 space-y-3">
            <div className="text-center">
              <p className="text-xs text-muted-gray">Contract Value</p>
              <p className="text-3xl font-bold text-accent-yellow">{fmt(calc.contractValue)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <div className="p-2 bg-muted-gray/10 rounded">
                <p className="text-xs text-muted-gray">Monthly</p>
                <p className="text-bone-white font-medium">{fmt(calc.monthlyTotal)}</p>
              </div>
              <div className="p-2 bg-muted-gray/10 rounded">
                <p className="text-xs text-muted-gray">Term</p>
                <p className="text-bone-white font-medium">{w.termType === 'annual' ? '12 months' : `${w.termMonths} months`}</p>
              </div>
            </div>
            {w.termType === 'annual' && (
              <div className="text-center">
                <p className="text-xs text-green-400">Annual savings: {fmt(calc.annualSavings)} (eff. {fmtD(calc.effectiveMonthly)}/mo)</p>
              </div>
            )}
            {w.trialType !== 'none' && (
              <p className="text-xs text-muted-gray text-center">Includes {w.trialType.replace('day', '-day')} trial</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={onSave} disabled={saving || !w.clientName}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
              Save Quote
            </Button>
            <Button variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Wizard Container
// =============================================================================

function PricingWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [w, setWizard] = useState<WizardState>(DEFAULT_WIZARD);
  const createQuote = useCreateQuote();

  const set = useCallback((updates: Partial<WizardState>) => {
    setWizard(prev => ({ ...prev, ...updates }));
  }, []);

  const calc = useMemo(() => calcLocal(w), [w]);

  const canNext = () => {
    if (w.step === 0) return !!w.clientName;
    return true;
  };

  const handleSave = async () => {
    try {
      await createQuote.mutateAsync({
        client_name: w.clientName,
        region: w.region,
        production_type: w.productionType,
        start_date: w.startDate || null,
        end_date: w.endDate || null,
        term_type: w.termType,
        term_months: w.termType === 'annual' ? 12 : w.termMonths,
        trial_type: w.trialType,
        tier: w.tier,
        is_production_package: w.isProductionPackage,
        linked_contact_id: w.linkedContactId || null,
        notes: w.notes,
        raw_input: {
          tier: w.tier,
          term_type: w.termType,
          term_months: w.termType === 'annual' ? 12 : w.termMonths,
          required_owner_seats: w.requiredOwnerSeats,
          required_collaborative_seats: w.requiredCollaborativeSeats,
          active_projects: w.activeProjects,
          required_non_collaborative_per_project: w.requiredNonCollaborativePerProject,
          required_view_only_per_project: w.requiredViewOnlyPerProject,
          required_active_storage_tb: w.requiredActiveStorageTB,
          required_archive_storage_tb: w.requiredArchiveStorageTB,
          required_bandwidth_gb: w.requiredBandwidthGB,
          bug_reward: w.bugReward,
          is_production_package: w.isProductionPackage,
          phases: w.isProductionPackage ? w.phases.map(p => ({
            name: p.name,
            months: p.months,
            active_projects: p.activeProjects,
            required_owner_seats: p.requiredOwnerSeats,
            required_collaborative_seats: p.requiredCollaborativeSeats,
            required_non_collaborative_per_project: p.requiredNonCollaborativePerProject,
            required_view_only_per_project: p.requiredViewOnlyPerProject,
            required_active_storage_tb: p.requiredActiveStorageTB,
            required_archive_storage_tb: p.requiredArchiveStorageTB,
            required_bandwidth_gb: p.requiredBandwidthGB,
          })) : undefined,
        },
      });
      toast({ title: 'Quote saved successfully' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const stepIcons = [ClipboardList, Zap, Users, HardDrive, BarChart3, Award, FileText];

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {STEPS.map((name, i) => {
          const Icon = stepIcons[i];
          return (
            <button key={i} onClick={() => i <= w.step && set({ step: i })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === w.step ? 'bg-accent-yellow text-charcoal-black' :
                i < w.step ? 'bg-accent-yellow/20 text-accent-yellow cursor-pointer' :
                'bg-muted-gray/10 text-muted-gray'
              }`}>
              <Icon className="h-3.5 w-3.5" />
              {name}
            </button>
          );
        })}
      </div>

      {/* Live price ticker */}
      <div className="flex items-center justify-between p-3 mb-4 rounded-lg bg-muted-gray/10 border border-muted-gray/20">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-gray">Tier: <span className="text-bone-white">{TIERS[w.tier].label}</span></span>
          <span className="text-muted-gray">Monthly: <span className="text-accent-yellow font-medium">{fmt(calc.monthlyTotal)}</span></span>
        </div>
        <span className="text-sm text-muted-gray">Contract: <span className="text-bone-white font-medium">{fmt(calc.contractValue)}</span></span>
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {w.step === 0 && <StepClientInfo w={w} set={set} />}
        {w.step === 1 && <StepTier w={w} set={set} />}
        {w.step === 2 && <StepSeatsProjects w={w} set={set} calc={calc} />}
        {w.step === 3 && <StepStorageBandwidth w={w} set={set} calc={calc} />}
        {w.step === 4 && <StepPhases w={w} set={set} />}
        {w.step === 5 && <StepDiscounts w={w} set={set} calc={calc} />}
        {w.step === 6 && <StepSummary w={w} calc={calc} onSave={handleSave} saving={createQuote.isPending} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-muted-gray/20">
        <div>
          {w.step > 0 ? (
            <Button variant="outline" onClick={() => set({ step: w.step - 1 })}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          )}
        </div>
        {w.step < STEPS.length - 1 && (
          <Button onClick={() => set({ step: w.step + 1 })} disabled={!canNext()}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Quote List
// =============================================================================

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function QuoteList({ onNewQuote }: { onNewQuote: () => void }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuotesList({ status: statusFilter !== 'all' ? statusFilter : undefined, search: search || undefined });
  const updateStatus = useUpdateQuoteStatus();
  const [viewQuote, setViewQuote] = useState<any>(null);

  const quotes = data?.quotes || [];

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast({ title: `Quote marked as ${status}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCopyText = async (quote: any) => {
    try {
      const res = await api.getPricingQuoteText(quote.id);
      await navigator.clipboard.writeText(res.text);
      toast({ title: 'Quote text copied to clipboard' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-gray" />
            <Input className="pl-8 w-[200px]" placeholder="Search quotes..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onNewQuote}><Plus className="h-4 w-4 mr-1" /> New Quote</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-gray py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading quotes...</div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16 text-muted-gray">
          <Calculator className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-lg">No quotes yet</p>
          <p className="text-sm mt-1">Create your first Backlot subscription quote.</p>
          <Button className="mt-4" onClick={onNewQuote}><Plus className="h-4 w-4 mr-1" /> New Quote</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((q: any) => (
            <div key={q.id} className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge className={STATUS_COLORS[q.status] || ''}>{q.status}</Badge>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-bone-white truncate">{q.client_name}</h3>
                    <p className="text-xs text-muted-gray">{q.tier?.charAt(0).toUpperCase() + q.tier?.slice(1)} · {q.term_type === 'annual' ? 'Annual' : `${q.term_months}mo`} · by {q.created_by_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-accent-yellow">{fmt(parseFloat(q.total_contract_value))}</p>
                    <p className="text-xs text-muted-gray">{fmt(parseFloat(q.monthly_total))}/mo</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewQuote(q)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleCopyText(q)}><Copy className="h-3.5 w-3.5" /></Button>
                    {q.status === 'draft' && (
                      <Button variant="ghost" size="sm" className="text-blue-400" onClick={() => handleStatusChange(q.id, 'sent')}><Send className="h-3.5 w-3.5" /></Button>
                    )}
                    {q.status === 'sent' && (
                      <>
                        <Button variant="ghost" size="sm" className="text-green-400" onClick={() => handleStatusChange(q.id, 'accepted')}><Check className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-400" onClick={() => handleStatusChange(q.id, 'lost')}><X className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quote detail dialog */}
      <Dialog open={!!viewQuote} onOpenChange={open => { if (!open) setViewQuote(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Quote — {viewQuote?.client_name}</DialogTitle>
            <DialogDescription>{viewQuote?.tier?.charAt(0).toUpperCase() + viewQuote?.tier?.slice(1)} · {viewQuote?.term_type === 'annual' ? 'Annual Prepay' : `${viewQuote?.term_months}-month term`}</DialogDescription>
          </DialogHeader>
          {viewQuote && (() => {
            const lineItems = typeof viewQuote.line_items === 'string' ? JSON.parse(viewQuote.line_items) : (viewQuote.line_items || []);
            return (
              <div className="space-y-3">
                <div className="space-y-1 text-sm">
                  {lineItems.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-gray">{item.label}</span>
                      <span className="text-bone-white">{fmt(item.total)}/mo</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-muted-gray/20 pt-2 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-muted-gray">Monthly Total</span><span className="text-accent-yellow font-medium">{fmt(parseFloat(viewQuote.monthly_total))}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-gray">Contract Value</span><span className="text-bone-white font-medium">{fmt(parseFloat(viewQuote.total_contract_value))}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-gray">Effective Monthly</span><span className="text-bone-white">{fmtD(parseFloat(viewQuote.effective_monthly_rate))}</span></div>
                </div>
                {viewQuote.trial_type !== 'none' && <p className="text-xs text-muted-gray">Trial: {viewQuote.trial_type.replace('day', '-day')}</p>}
                {viewQuote.notes && <p className="text-xs text-muted-gray border-t border-muted-gray/20 pt-2">{viewQuote.notes}</p>}
                <p className="text-xs text-muted-gray">Created {new Date(viewQuote.created_at).toLocaleString()}</p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// need api import for copy text
import { api } from '@/lib/api';

// =============================================================================
// Main Pricing Tab
// =============================================================================

const PricingTab = () => {
  const [showWizard, setShowWizard] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-accent-yellow" />
        <h2 className="text-lg font-heading text-bone-white">Pricing & Quotes</h2>
      </div>

      {showWizard ? (
        <PricingWizard onClose={() => setShowWizard(false)} onSaved={() => setShowWizard(false)} />
      ) : (
        <QuoteList onNewQuote={() => setShowWizard(true)} />
      )}
    </div>
  );
};

export default PricingTab;
