/**
 * BudgetCreationModal - Intentional Budget Creation Wizard
 *
 * This modal allows users to create a budget by explicitly choosing
 * what to seed:
 * - "blank": Start with no categories/line items
 * - "categories_only": Create high-level category shells
 * - "bundles": Select specific department bundles
 * - "essentials": Start with core essential items
 *
 * KEY PRINCIPLE: NO auto-populating giant templates. Users decide what goes in.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  FileText,
  Layers,
  Boxes,
  Sparkles,
  Check,
  ChevronRight,
  Film,
  Tv,
  Video,
  Music,
  Megaphone,
  Clapperboard,
  Camera,
  Lightbulb,
  Mic,
  Palette,
  Scissors,
  Truck,
  Coffee,
  Shield,
  FileSpreadsheet,
  Building2,
  DollarSign,
  Users,
  LayoutList,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useRecommendedBundles,
  useCreateBudgetFromBundles,
} from '@/hooks/backlot/useBudget';
import {
  BacklotBudgetProjectType,
  BudgetSeedMode,
  DepartmentBundle,
  BUDGET_PROJECT_TYPE_LABELS,
  SEED_MODE_LABELS,
  SEED_MODE_DESCRIPTIONS,
} from '@/types/backlot';

interface BudgetCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectType?: BacklotBudgetProjectType;
  onSuccess?: (budgetId: string) => void;
}

const PROJECT_TYPE_ICONS: Record<BacklotBudgetProjectType, React.ReactNode> = {
  feature: <Film className="w-4 h-4" />,
  episodic: <Tv className="w-4 h-4" />,
  documentary: <Video className="w-4 h-4" />,
  music_video: <Music className="w-4 h-4" />,
  commercial: <Megaphone className="w-4 h-4" />,
  short: <Clapperboard className="w-4 h-4" />,
  custom: <FileSpreadsheet className="w-4 h-4" />,
};

const SEED_MODE_ICONS: Record<BudgetSeedMode, React.ReactNode> = {
  blank: <FileText className="w-5 h-5" />,
  categories_only: <Layers className="w-5 h-5" />,
  bundles: <Boxes className="w-5 h-5" />,
  essentials: <Sparkles className="w-5 h-5" />,
};

const BUNDLE_CATEGORY_ICONS: Record<string, React.ReactNode> = {
  atl_story_rights: <FileText className="w-4 h-4" />,
  atl_producer: <Users className="w-4 h-4" />,
  atl_director: <Clapperboard className="w-4 h-4" />,
  atl_cast: <Users className="w-4 h-4" />,
  camera: <Camera className="w-4 h-4" />,
  grip_electric: <Lightbulb className="w-4 h-4" />,
  sound: <Mic className="w-4 h-4" />,
  art_dept: <Palette className="w-4 h-4" />,
  wardrobe: <Users className="w-4 h-4" />,
  hair_makeup: <Users className="w-4 h-4" />,
  locations: <Building2 className="w-4 h-4" />,
  transportation: <Truck className="w-4 h-4" />,
  catering: <Coffee className="w-4 h-4" />,
  post_editorial: <Scissors className="w-4 h-4" />,
  post_sound: <Mic className="w-4 h-4" />,
  post_music: <Music className="w-4 h-4" />,
  post_vfx: <Sparkles className="w-4 h-4" />,
  post_color: <Palette className="w-4 h-4" />,
  insurance: <Shield className="w-4 h-4" />,
  legal_accounting: <FileSpreadsheet className="w-4 h-4" />,
  office: <Building2 className="w-4 h-4" />,
  publicity: <Megaphone className="w-4 h-4" />,
};

const CATEGORY_TYPE_COLORS: Record<string, string> = {
  above_the_line: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  production: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  post: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const CATEGORY_TYPE_LABELS: Record<string, string> = {
  above_the_line: 'ATL',
  production: 'PROD',
  post: 'POST',
  other: 'OTHER',
};

export const BudgetCreationModal: React.FC<BudgetCreationModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectType: initialProjectType = 'feature',
  onSuccess,
}) => {
  // State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [budgetName, setBudgetName] = useState('Main Budget');
  const [projectType, setProjectType] = useState<BacklotBudgetProjectType>(initialProjectType);
  const [seedMode, setSeedMode] = useState<BudgetSeedMode>('bundles');
  const [selectedBundles, setSelectedBundles] = useState<Set<string>>(new Set());
  const [shootDays, setShootDays] = useState(10);
  const [prepDays, setPrepDays] = useState(5);
  const [wrapDays, setWrapDays] = useState(2);

  // Category toggles for categories_only mode
  const [includeATL, setIncludeATL] = useState(true);
  const [includeProduction, setIncludeProduction] = useState(true);
  const [includePost, setIncludePost] = useState(true);
  const [includeOther, setIncludeOther] = useState(true);

  // Hooks
  const { data: bundlesData, isLoading: bundlesLoading } = useRecommendedBundles(projectType);
  const createBudget = useCreateBudgetFromBundles();

  // Reset selected bundles when project type changes
  useEffect(() => {
    if (bundlesData?.recommended) {
      // Pre-select recommended bundles
      setSelectedBundles(new Set(bundlesData.recommended.map(b => b.id)));
    }
  }, [bundlesData?.recommended]);

  // Group bundles by category type
  const bundlesByType = useMemo(() => {
    if (!bundlesData?.all_available) return {};

    const groups: Record<string, DepartmentBundle[]> = {
      above_the_line: [],
      production: [],
      post: [],
      other: [],
    };

    bundlesData.all_available.forEach(bundle => {
      const type = bundle.category_type as string;
      if (groups[type]) {
        groups[type].push(bundle);
      }
    });

    return groups;
  }, [bundlesData?.all_available]);

  // Calculate totals
  const selectedBundlesList = useMemo(() => {
    if (!bundlesData?.all_available) return [];
    return bundlesData.all_available.filter(b => selectedBundles.has(b.id));
  }, [bundlesData?.all_available, selectedBundles]);

  const totalCategories = useMemo(() => {
    return selectedBundlesList.reduce((acc, b) => acc + b.categories.length, 0);
  }, [selectedBundlesList]);

  const totalLineItems = useMemo(() => {
    return selectedBundlesList.reduce((acc, b) => acc + b.total_line_items, 0);
  }, [selectedBundlesList]);

  // Toggle bundle selection
  const toggleBundle = (bundleId: string) => {
    const newSelected = new Set(selectedBundles);
    if (newSelected.has(bundleId)) {
      newSelected.delete(bundleId);
    } else {
      newSelected.add(bundleId);
    }
    setSelectedBundles(newSelected);
  };

  // Select all in category
  const selectAllInCategory = (categoryType: string) => {
    const bundles = bundlesByType[categoryType] || [];
    const newSelected = new Set(selectedBundles);
    bundles.forEach(b => newSelected.add(b.id));
    setSelectedBundles(newSelected);
  };

  // Deselect all in category
  const deselectAllInCategory = (categoryType: string) => {
    const bundles = bundlesByType[categoryType] || [];
    const bundleIds = new Set(bundles.map(b => b.id));
    const newSelected = new Set([...selectedBundles].filter(id => !bundleIds.has(id)));
    setSelectedBundles(newSelected);
  };

  // Handle creation
  const handleCreate = async () => {
    try {
      const result = await createBudget.mutateAsync({
        projectId,
        options: {
          name: budgetName,
          project_type: projectType,
          seed_mode: seedMode,
          selected_bundle_ids: seedMode === 'bundles' ? Array.from(selectedBundles) : [],
          shoot_days: shootDays,
          prep_days: prepDays,
          wrap_days: wrapDays,
          include_above_the_line: includeATL,
          include_production: includeProduction,
          include_post: includePost,
          include_other: includeOther,
        },
      });

      toast.success(`Budget created with ${result.categories_created} categories and ${result.line_items_created} line items`);

      if (onSuccess && result.budget.id) {
        onSuccess(result.budget.id);
      }

      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create budget');
    }
  };

  // Reset on close
  const handleClose = () => {
    setStep(1);
    setBudgetName('Main Budget');
    setSeedMode('bundles');
    setSelectedBundles(new Set());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-accent-yellow" />
            Create Budget
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Configure your budget settings and choose how to start.'}
            {step === 2 && seedMode === 'bundles' && 'Select department bundles to include in your budget.'}
            {step === 2 && seedMode === 'categories_only' && 'Choose which high-level categories to include.'}
            {step === 3 && 'Review your selections and create the budget.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 py-2 border-b border-muted-gray/30">
          <div className={`flex items-center gap-1 ${step >= 1 ? 'text-accent-yellow' : 'text-muted-gray'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-accent-yellow text-charcoal-black' : 'bg-muted-gray/30'}`}>
              {step > 1 ? <Check className="w-3 h-3" /> : '1'}
            </div>
            <span className="text-sm">Setup</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-gray" />
          <div className={`flex items-center gap-1 ${step >= 2 ? 'text-accent-yellow' : 'text-muted-gray'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-accent-yellow text-charcoal-black' : 'bg-muted-gray/30'}`}>
              {step > 2 ? <Check className="w-3 h-3" /> : '2'}
            </div>
            <span className="text-sm">Configure</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-gray" />
          <div className={`flex items-center gap-1 ${step >= 3 ? 'text-accent-yellow' : 'text-muted-gray'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 3 ? 'bg-accent-yellow text-charcoal-black' : 'bg-muted-gray/30'}`}>
              3
            </div>
            <span className="text-sm">Review</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-hidden">
          {/* Step 1: Basic Setup */}
          {step === 1 && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6 py-4">
                {/* Budget Name */}
                <div className="space-y-2">
                  <Label htmlFor="budget-name">Budget Name</Label>
                  <Input
                    id="budget-name"
                    value={budgetName}
                    onChange={(e) => setBudgetName(e.target.value)}
                    placeholder="Main Budget"
                  />
                </div>

                {/* Project Type */}
                <div className="space-y-2">
                  <Label>Project Type</Label>
                  <Select value={projectType} onValueChange={(v) => setProjectType(v as BacklotBudgetProjectType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(BUDGET_PROJECT_TYPE_LABELS) as [BacklotBudgetProjectType, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            {PROJECT_TYPE_ICONS[value]}
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Schedule Days */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shoot-days">Shoot Days</Label>
                    <Input
                      id="shoot-days"
                      type="number"
                      min="0"
                      value={shootDays}
                      onChange={(e) => setShootDays(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prep-days">Prep Days</Label>
                    <Input
                      id="prep-days"
                      type="number"
                      min="0"
                      value={prepDays}
                      onChange={(e) => setPrepDays(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wrap-days">Wrap Days</Label>
                    <Input
                      id="wrap-days"
                      type="number"
                      min="0"
                      value={wrapDays}
                      onChange={(e) => setWrapDays(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Seed Mode Selection */}
                <div className="space-y-3">
                  <Label>How would you like to start?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(SEED_MODE_LABELS) as BudgetSeedMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSeedMode(mode)}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          seedMode === mode
                            ? 'border-accent-yellow bg-accent-yellow/10'
                            : 'border-muted-gray/30 hover:border-muted-gray/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`${seedMode === mode ? 'text-accent-yellow' : 'text-muted-gray'}`}>
                            {SEED_MODE_ICONS[mode]}
                          </div>
                          <span className="font-medium">{SEED_MODE_LABELS[mode]}</span>
                        </div>
                        <p className="text-xs text-muted-gray">{SEED_MODE_DESCRIPTIONS[mode]}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Step 2: Configuration based on seed mode */}
          {step === 2 && (
            <ScrollArea className="h-[400px] pr-4">
              {seedMode === 'bundles' && (
                <div className="py-4 space-y-4">
                  {bundlesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-accent-yellow" />
                    </div>
                  ) : (
                    <Tabs defaultValue="above_the_line" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 mb-4">
                        <TabsTrigger value="above_the_line" className="text-xs">ATL</TabsTrigger>
                        <TabsTrigger value="production" className="text-xs">Production</TabsTrigger>
                        <TabsTrigger value="post" className="text-xs">Post</TabsTrigger>
                        <TabsTrigger value="other" className="text-xs">Other</TabsTrigger>
                      </TabsList>

                      {Object.entries(bundlesByType).map(([categoryType, bundles]) => (
                        <TabsContent key={categoryType} value={categoryType} className="space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-gray">
                              {bundles.length} bundles available
                            </span>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => selectAllInCategory(categoryType)}
                                className="text-xs"
                              >
                                Select All
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deselectAllInCategory(categoryType)}
                                className="text-xs"
                              >
                                Deselect All
                              </Button>
                            </div>
                          </div>

                          {bundles.map((bundle) => (
                            <button
                              key={bundle.id}
                              type="button"
                              onClick={() => toggleBundle(bundle.id)}
                              className={`w-full p-3 rounded-lg border text-left transition-all ${
                                selectedBundles.has(bundle.id)
                                  ? 'border-accent-yellow bg-accent-yellow/10'
                                  : 'border-muted-gray/30 hover:border-muted-gray/50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 ${selectedBundles.has(bundle.id) ? 'text-accent-yellow' : 'text-muted-gray'}`}>
                                  {BUNDLE_CATEGORY_ICONS[bundle.id] || <LayoutList className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">{bundle.name}</span>
                                    {bundle.is_recommended && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-accent-yellow/50 text-accent-yellow">
                                        Recommended
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-gray line-clamp-1">{bundle.description}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-muted-gray">
                                      {bundle.categories.length} categories
                                    </span>
                                    <span className="text-[10px] text-muted-gray">
                                      {bundle.total_line_items} line items
                                    </span>
                                  </div>
                                </div>
                                <Checkbox checked={selectedBundles.has(bundle.id)} />
                              </div>
                            </button>
                          ))}
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </div>
              )}

              {seedMode === 'categories_only' && (
                <div className="py-4 space-y-4">
                  <p className="text-sm text-muted-gray mb-4">
                    Select which high-level category groups to include. These will be created as empty categories ready for you to add line items.
                  </p>

                  {[
                    { id: 'above_the_line', label: 'Above the Line', desc: 'Story, Producer, Director, Cast', checked: includeATL, onChange: setIncludeATL },
                    { id: 'production', label: 'Production', desc: 'Camera, Sound, Art, Locations, etc.', checked: includeProduction, onChange: setIncludeProduction },
                    { id: 'post', label: 'Post-Production', desc: 'Editorial, Sound, Music, VFX, Color', checked: includePost, onChange: setIncludePost },
                    { id: 'other', label: 'Other/Indirect', desc: 'Insurance, Legal, Office, Publicity', checked: includeOther, onChange: setIncludeOther },
                  ].map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        item.checked
                          ? 'border-accent-yellow bg-accent-yellow/10'
                          : 'border-muted-gray/30 hover:border-muted-gray/50'
                      }`}
                    >
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={(checked) => item.onChange(checked as boolean)}
                      />
                      <div>
                        <div className="font-medium">{item.label}</div>
                        <p className="text-xs text-muted-gray">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {seedMode === 'blank' && (
                <div className="py-8 text-center">
                  <FileText className="w-12 h-12 text-muted-gray mx-auto mb-4" />
                  <h3 className="font-medium mb-2">Starting with a Blank Budget</h3>
                  <p className="text-sm text-muted-gray max-w-md mx-auto">
                    Your budget will be created with no categories or line items.
                    You can add everything manually from scratch.
                  </p>
                </div>
              )}

              {seedMode === 'essentials' && (
                <div className="py-8 text-center">
                  <Sparkles className="w-12 h-12 text-accent-yellow mx-auto mb-4" />
                  <h3 className="font-medium mb-2">Core Essentials</h3>
                  <p className="text-sm text-muted-gray max-w-md mx-auto">
                    We'll include the most essential line items for your {BUDGET_PROJECT_TYPE_LABELS[projectType]} project.
                    This is a minimal starting point you can build from.
                  </p>
                </div>
              )}
            </ScrollArea>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
                  <h3 className="font-medium mb-3">Budget Summary</h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Name:</span>
                      <span>{budgetName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Project Type:</span>
                      <span className="flex items-center gap-1">
                        {PROJECT_TYPE_ICONS[projectType]}
                        {BUDGET_PROJECT_TYPE_LABELS[projectType]}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Seed Mode:</span>
                      <span className="flex items-center gap-1">
                        {SEED_MODE_ICONS[seedMode]}
                        {SEED_MODE_LABELS[seedMode]}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Schedule:</span>
                      <span>{prepDays} prep + {shootDays} shoot + {wrapDays} wrap days</span>
                    </div>
                  </div>
                </div>

                {seedMode === 'bundles' && selectedBundles.size > 0 && (
                  <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
                    <h3 className="font-medium mb-3">Selected Bundles ({selectedBundles.size})</h3>

                    <div className="space-y-2">
                      {selectedBundlesList.map((bundle) => (
                        <div key={bundle.id} className="flex items-center gap-2 text-sm">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${CATEGORY_TYPE_COLORS[bundle.category_type]}`}
                          >
                            {CATEGORY_TYPE_LABELS[bundle.category_type]}
                          </Badge>
                          <span>{bundle.name}</span>
                          <span className="text-muted-gray ml-auto">
                            {bundle.total_line_items} items
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-muted-gray/30 flex justify-between text-sm font-medium">
                      <span>Total:</span>
                      <span>{totalCategories} categories, {totalLineItems} line items</span>
                    </div>
                  </div>
                )}

                {seedMode === 'categories_only' && (
                  <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
                    <h3 className="font-medium mb-3">Categories to Create</h3>
                    <div className="space-y-1 text-sm">
                      {includeATL && <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Above the Line</div>}
                      {includeProduction && <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Production</div>}
                      {includePost && <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Post-Production</div>}
                      {includeOther && <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Other/Indirect</div>}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-muted-gray/30">
          <Button variant="ghost" onClick={step === 1 ? handleClose : () => setStep((s) => (s - 1) as any)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          <div className="flex gap-2">
            {step < 3 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as any)}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                disabled={step === 2 && seedMode === 'bundles' && selectedBundles.size === 0}
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                disabled={createBudget.isPending}
              >
                {createBudget.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Budget'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BudgetCreationModal;
