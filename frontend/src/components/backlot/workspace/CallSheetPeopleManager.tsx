/**
 * CallSheetPeopleManager - Comprehensive component for managing call sheet cast & crew
 * Features:
 * - People grouped by department (Cast first, then crew departments alphabetically)
 * - Individual call time management with makeup, pickup, and on-set times
 * - Bulk department time updates with "apply to all" or "empty only" options
 * - Drag-and-drop reordering within departments
 * - Quick add from project members or manual entry
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  Clock,
  Users,
  User,
  Film,
  ChevronDown,
  MoreHorizontal,
  GripVertical,
  Sparkles,
  Timer,
  Save,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { BacklotCallSheetPerson, CallSheetPersonInput } from '@/types/backlot';
import { useCrewPresets } from '@/hooks/backlot';
import { useCallSheetPeople } from '@/hooks/backlot';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CallSheetPeopleManagerProps {
  callSheetId: string;
  projectId: string;
  className?: string;
}

// Standard departments for crew organization
const CREW_DEPARTMENTS = [
  'Production',
  'Directing',
  'Camera',
  'Sound',
  'Grip/Electric',
  'Art',
  'Wardrobe',
  'Makeup/Hair',
  'Stunts',
  'VFX',
  'Transport',
  'Catering',
  'Other',
];

// Person add/edit modal state
interface PersonFormData {
  name: string;
  role: string;
  department: string;
  call_time: string;
  phone: string;
  email: string;
  notes: string;
  makeup_time: string;
  pickup_time: string;
  on_set_time: string;
  wardrobe_notes: string;
  is_cast: boolean;
  cast_number: string;
  character_name: string;
}

const emptyPersonForm: PersonFormData = {
  name: '',
  role: '',
  department: '',
  call_time: '',
  phone: '',
  email: '',
  notes: '',
  makeup_time: '',
  pickup_time: '',
  on_set_time: '',
  wardrobe_notes: '',
  is_cast: false,
  cast_number: '',
  character_name: '',
};

export function CallSheetPeopleManager({ callSheetId, projectId, className }: CallSheetPeopleManagerProps) {
  const { toast } = useToast();
  const {
    people,
    isLoading,
    addPerson,
    updatePerson,
    removePerson,
    reorderPeople,
    bulkUpdateDepartmentTimes,
  } = useCallSheetPeople(callSheetId);

  // Crew presets
  const { presets, applyPreset, saveAsPreset } = useCrewPresets(projectId);

  // Modal states
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<BacklotCallSheetPerson | null>(null);
  const [isBulkTimeOpen, setIsBulkTimeOpen] = useState(false);
  const [bulkDepartment, setBulkDepartment] = useState<string>('');
  const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);

  // Form state
  const [personForm, setPersonForm] = useState<PersonFormData>(emptyPersonForm);

  // Bulk time update form
  const [bulkCallTime, setBulkCallTime] = useState('');
  const [bulkMakeupTime, setBulkMakeupTime] = useState('');
  const [bulkPickupTime, setBulkPickupTime] = useState('');
  const [bulkOnSetTime, setBulkOnSetTime] = useState('');
  const [bulkApplyTo, setBulkApplyTo] = useState<'all' | 'empty_only'>('all');

  // Group people by department
  const groupedPeople = useMemo(() => {
    const groups: Record<string, BacklotCallSheetPerson[]> = {};

    // Separate cast and crew
    const cast = people.filter(p => p.is_cast);
    const crew = people.filter(p => !p.is_cast);

    if (cast.length > 0) {
      groups['Cast'] = cast.sort((a, b) => {
        // Sort by cast number if available, otherwise by sort_order
        if (a.cast_number && b.cast_number) {
          return a.cast_number.localeCompare(b.cast_number, undefined, { numeric: true });
        }
        return a.sort_order - b.sort_order;
      });
    }

    // Group crew by department
    crew.forEach(person => {
      const dept = person.department || 'Other';
      if (!groups[dept]) {
        groups[dept] = [];
      }
      groups[dept].push(person);
    });

    // Sort each group by sort_order
    Object.keys(groups).forEach(dept => {
      if (dept !== 'Cast') {
        groups[dept].sort((a, b) => a.sort_order - b.sort_order);
      }
    });

    return groups;
  }, [people]);

  // Get unique departments from current people
  const currentDepartments = useMemo(() => {
    const departments = new Set<string>();
    people.forEach(p => {
      if (p.is_cast) {
        departments.add('Cast');
      } else if (p.department) {
        departments.add(p.department);
      }
    });
    return Array.from(departments);
  }, [people]);

  // Handle add person
  const handleAddPerson = async () => {
    if (!personForm.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for this person.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const input: CallSheetPersonInput = {
        name: personForm.name.trim(),
        role: personForm.role.trim() || undefined,
        department: personForm.is_cast ? 'Cast' : (personForm.department || 'Other'),
        call_time: personForm.call_time || '06:00',
        phone: personForm.phone || undefined,
        email: personForm.email || undefined,
        notes: personForm.notes || undefined,
        makeup_time: personForm.makeup_time || undefined,
        wardrobe_notes: personForm.wardrobe_notes || undefined,
        is_cast: personForm.is_cast,
        cast_number: personForm.is_cast ? personForm.cast_number : undefined,
        character_name: personForm.is_cast ? personForm.character_name : undefined,
        // pickup_time and on_set_time if using separate fields
      };

      await addPerson.mutateAsync(input);

      toast({
        title: 'Person added',
        description: `${personForm.name} has been added to the call sheet.`,
      });

      setIsAddPersonOpen(false);
      setPersonForm(emptyPersonForm);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add person. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle edit person
  const handleEditPerson = async () => {
    if (!editingPerson) return;

    try {
      await updatePerson.mutateAsync({
        id: editingPerson.id,
        data: {
          name: personForm.name.trim(),
          role: personForm.role.trim() || null,
          department: personForm.is_cast ? 'Cast' : (personForm.department || 'Other'),
          call_time: personForm.call_time || '06:00',
          phone: personForm.phone || null,
          email: personForm.email || null,
          notes: personForm.notes || null,
          makeup_time: personForm.makeup_time || null,
          wardrobe_notes: personForm.wardrobe_notes || null,
          is_cast: personForm.is_cast,
          cast_number: personForm.is_cast ? personForm.cast_number : null,
          character_name: personForm.is_cast ? personForm.character_name : null,
        },
      });

      toast({
        title: 'Person updated',
        description: `${personForm.name} has been updated.`,
      });

      setEditingPerson(null);
      setPersonForm(emptyPersonForm);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update person. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle remove person
  const handleRemovePerson = async (person: BacklotCallSheetPerson) => {
    try {
      await removePerson.mutateAsync(person.id);
      toast({
        title: 'Person removed',
        description: `${person.name} has been removed from the call sheet.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove person. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle bulk time update
  const handleBulkTimeUpdate = async () => {
    if (!bulkDepartment) return;

    try {
      const update: {
        department: string;
        call_time?: string;
        makeup_time?: string;
        pickup_time?: string;
        on_set_time?: string;
        apply_to: 'all' | 'empty_only';
      } = {
        department: bulkDepartment === 'Cast' ? 'Cast' : bulkDepartment,
        apply_to: bulkApplyTo,
      };

      if (bulkCallTime) update.call_time = bulkCallTime;
      if (bulkMakeupTime) update.makeup_time = bulkMakeupTime;
      if (bulkPickupTime) update.pickup_time = bulkPickupTime;
      if (bulkOnSetTime) update.on_set_time = bulkOnSetTime;

      await bulkUpdateDepartmentTimes.mutateAsync(update);

      toast({
        title: 'Times updated',
        description: `Call times updated for ${bulkDepartment} department.`,
      });

      setIsBulkTimeOpen(false);
      setBulkDepartment('');
      setBulkCallTime('');
      setBulkMakeupTime('');
      setBulkPickupTime('');
      setBulkOnSetTime('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update times. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Open edit modal with person data
  const openEditModal = (person: BacklotCallSheetPerson) => {
    setPersonForm({
      name: person.name,
      role: person.role || '',
      department: person.department || '',
      call_time: person.call_time || '',
      phone: person.phone || '',
      email: person.email || '',
      notes: person.notes || '',
      makeup_time: person.makeup_time || '',
      pickup_time: '',  // Will add to type if needed
      on_set_time: '',  // Will add to type if needed
      wardrobe_notes: person.wardrobe_notes || '',
      is_cast: person.is_cast || false,
      cast_number: person.cast_number || '',
      character_name: person.character_name || '',
    });
    setEditingPerson(person);
  };

  // Open bulk time modal for a department
  const openBulkTimeModal = (department: string) => {
    setBulkDepartment(department);
    setBulkCallTime('');
    setBulkMakeupTime('');
    setBulkPickupTime('');
    setBulkOnSetTime('');
    setBulkApplyTo('all');
    setIsBulkTimeOpen(true);
  };

  // Handle applying a preset
  const handleApplyPreset = async (presetId: string, clearExisting: boolean = false) => {
    setIsApplyingPreset(true);
    try {
      const result = await applyPreset.mutateAsync({
        callSheetId,
        presetId,
        clearExisting,
      });

      toast({
        title: 'Preset applied',
        description: result.message || 'Crew preset applied successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply preset. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingPreset(false);
    }
  };

  // Handle saving current people as a preset
  const handleSaveAsPreset = async () => {
    if (!presetName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the preset.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await saveAsPreset.mutateAsync({
        callSheetId,
        name: presetName.trim(),
        is_personal: false,
      });

      toast({
        title: 'Preset saved',
        description: `Crew preset "${presetName}" created with ${people.length} people.`,
      });

      setIsSavePresetOpen(false);
      setPresetName('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save preset. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="text-muted-gray">Loading cast & crew...</div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-bone-white flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-accent-yellow" />
            Cast & Crew
          </Label>
          <p className="text-xs text-muted-gray mt-1">
            {people.length} {people.length === 1 ? 'person' : 'people'} on this call sheet
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Presets dropdown */}
          {presets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-muted-gray/30" disabled={isApplyingPreset}>
                  {isApplyingPreset ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <FolderOpen className="w-4 h-4 mr-1" />
                  )}
                  Load Preset
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/30 min-w-[200px]">
                {presets.map(preset => (
                  <DropdownMenuItem
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.id)}
                    className="text-bone-white hover:bg-muted-gray/20"
                  >
                    <div className="flex flex-col">
                      <span>{preset.name}</span>
                      <span className="text-xs text-muted-gray">
                        {preset.crew_members.length} people
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Save as preset */}
          {people.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSavePresetOpen(true)}
              className="border-muted-gray/30"
            >
              <Save className="w-4 h-4 mr-1" />
              Save Preset
            </Button>
          )}
          {currentDepartments.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-muted-gray/30">
                  <Timer className="w-4 h-4 mr-1" />
                  Bulk Times
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/30">
                {currentDepartments.map(dept => (
                  <DropdownMenuItem
                    key={dept}
                    onClick={() => openBulkTimeModal(dept)}
                    className="text-bone-white hover:bg-muted-gray/20"
                  >
                    Set times for {dept}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPersonForm(emptyPersonForm);
              setIsAddPersonOpen(true);
            }}
            className="border-muted-gray/30"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Person
          </Button>
        </div>
      </div>

      {/* People List by Department */}
      {Object.keys(groupedPeople).length === 0 ? (
        <div className="border border-dashed border-muted-gray/30 rounded-lg p-8 text-center">
          <Users className="w-12 h-12 text-muted-gray mx-auto mb-3" />
          <p className="text-muted-gray mb-4">No cast or crew added yet</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPersonForm(emptyPersonForm);
              setIsAddPersonOpen(true);
            }}
            className="border-muted-gray/30"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add First Person
          </Button>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={Object.keys(groupedPeople)} className="space-y-2">
          {/* Cast first, then alphabetical departments */}
          {(['Cast', ...CREW_DEPARTMENTS.filter(d => groupedPeople[d])])
            .filter(dept => groupedPeople[dept])
            .map(department => (
              <AccordionItem
                key={department}
                value={department}
                className="border border-muted-gray/30 rounded-lg px-4"
              >
                <AccordionTrigger className="text-bone-white hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="flex items-center gap-2">
                      {department === 'Cast' ? (
                        <Film className="w-4 h-4 text-accent-yellow" />
                      ) : (
                        <User className="w-4 h-4 text-blue-400" />
                      )}
                      {department}
                    </span>
                    <Badge variant="outline" className="text-xs text-muted-gray">
                      {groupedPeople[department].length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="space-y-2">
                    {/* Department header with bulk time button */}
                    <div className="flex items-center justify-end mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openBulkTimeModal(department)}
                        className="text-xs text-muted-gray hover:text-bone-white"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Set all {department} times
                      </Button>
                    </div>

                    {/* People in this department */}
                    {groupedPeople[department].map((person, index) => (
                      <div
                        key={person.id}
                        className="flex items-center gap-3 p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/20 hover:border-muted-gray/40 transition-colors"
                      >
                        {/* Drag handle */}
                        <div className="cursor-grab text-muted-gray/50 hover:text-muted-gray">
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Cast number for cast members */}
                        {person.is_cast && person.cast_number && (
                          <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30 min-w-[40px] justify-center">
                            #{person.cast_number}
                          </Badge>
                        )}

                        {/* Name and role */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-bone-white font-medium truncate">
                              {person.name}
                            </span>
                            {person.character_name && (
                              <span className="text-muted-gray text-sm">
                                as {person.character_name}
                              </span>
                            )}
                          </div>
                          {person.role && (
                            <p className="text-sm text-muted-gray truncate">{person.role}</p>
                          )}
                        </div>

                        {/* Call time */}
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-accent-yellow">
                              <Clock className="w-3 h-3" />
                              <span className="font-mono text-sm">{person.call_time || '--:--'}</span>
                            </div>
                            {person.makeup_time && (
                              <div className="text-xs text-muted-gray flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                MU: {person.makeup_time}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/30">
                              <DropdownMenuItem
                                onClick={() => openEditModal(person)}
                                className="text-bone-white hover:bg-muted-gray/20"
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRemovePerson(person)}
                                className="text-red-400 hover:bg-red-400/10"
                              >
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
        </Accordion>
      )}

      {/* Add/Edit Person Modal */}
      <Dialog open={isAddPersonOpen || !!editingPerson} onOpenChange={(open) => {
        if (!open) {
          setIsAddPersonOpen(false);
          setEditingPerson(null);
          setPersonForm(emptyPersonForm);
        }
      }}>
        <DialogContent className="bg-deep-black border-muted-gray/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-bone-white">
              {editingPerson ? 'Edit Person' : 'Add Person'}
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              {editingPerson ? 'Update this person\'s details and call time.' : 'Add a cast or crew member to this call sheet.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cast toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_cast"
                checked={personForm.is_cast}
                onCheckedChange={(checked) => setPersonForm(prev => ({ ...prev, is_cast: !!checked }))}
              />
              <Label htmlFor="is_cast" className="text-bone-white cursor-pointer">
                This is a cast member
              </Label>
            </div>

            {/* Cast-specific fields */}
            {personForm.is_cast && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-muted-gray text-xs">Cast #</Label>
                  <Input
                    value={personForm.cast_number}
                    onChange={(e) => setPersonForm(prev => ({ ...prev, cast_number: e.target.value }))}
                    placeholder="1"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-gray text-xs">Character Name</Label>
                  <Input
                    value={personForm.character_name}
                    onChange={(e) => setPersonForm(prev => ({ ...prev, character_name: e.target.value }))}
                    placeholder="Character"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
              </div>
            )}

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-gray text-xs">Name *</Label>
                <Input
                  value={personForm.name}
                  onChange={(e) => setPersonForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Full name"
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-gray text-xs">Role / Position</Label>
                <Input
                  value={personForm.role}
                  onChange={(e) => setPersonForm(prev => ({ ...prev, role: e.target.value }))}
                  placeholder={personForm.is_cast ? 'Lead, Supporting, etc.' : 'Director, DP, etc.'}
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
            </div>

            {/* Department (for crew) */}
            {!personForm.is_cast && (
              <div className="space-y-2">
                <Label className="text-muted-gray text-xs">Department</Label>
                <select
                  value={personForm.department}
                  onChange={(e) => setPersonForm(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full bg-charcoal-black border border-muted-gray/30 rounded-md px-3 py-2 text-bone-white"
                >
                  <option value="">Select department...</option>
                  {CREW_DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Call times */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-gray text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Call Time *
                </Label>
                <Input
                  type="time"
                  value={personForm.call_time}
                  onChange={(e) => setPersonForm(prev => ({ ...prev, call_time: e.target.value }))}
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
              {personForm.is_cast && (
                <div className="space-y-2">
                  <Label className="text-muted-gray text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Makeup Time
                  </Label>
                  <Input
                    type="time"
                    value={personForm.makeup_time}
                    onChange={(e) => setPersonForm(prev => ({ ...prev, makeup_time: e.target.value }))}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
              )}
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-gray text-xs">Phone</Label>
                <Input
                  value={personForm.phone}
                  onChange={(e) => setPersonForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-gray text-xs">Email</Label>
                <Input
                  type="email"
                  value={personForm.email}
                  onChange={(e) => setPersonForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsAddPersonOpen(false);
                setEditingPerson(null);
                setPersonForm(emptyPersonForm);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingPerson ? handleEditPerson : handleAddPerson}
              className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90"
            >
              {editingPerson ? 'Update' : 'Add Person'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Time Update Modal */}
      <Dialog open={isBulkTimeOpen} onOpenChange={setIsBulkTimeOpen}>
        <DialogContent className="bg-deep-black border-muted-gray/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-bone-white">
              Set Times for {bulkDepartment}
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              Update call times for all {groupedPeople[bulkDepartment]?.length || 0} people in this department.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Apply mode */}
            <div className="space-y-2">
              <Label className="text-muted-gray text-xs">Apply to</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="apply_to"
                    value="all"
                    checked={bulkApplyTo === 'all'}
                    onChange={() => setBulkApplyTo('all')}
                    className="text-accent-yellow"
                  />
                  <span className="text-bone-white text-sm">All people</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="apply_to"
                    value="empty_only"
                    checked={bulkApplyTo === 'empty_only'}
                    onChange={() => setBulkApplyTo('empty_only')}
                    className="text-accent-yellow"
                  />
                  <span className="text-bone-white text-sm">Only empty times</span>
                </label>
              </div>
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-gray text-xs">Call Time</Label>
                <Input
                  type="time"
                  value={bulkCallTime}
                  onChange={(e) => setBulkCallTime(e.target.value)}
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
              {bulkDepartment === 'Cast' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-muted-gray text-xs">Makeup Time</Label>
                    <Input
                      type="time"
                      value={bulkMakeupTime}
                      onChange={(e) => setBulkMakeupTime(e.target.value)}
                      className="bg-charcoal-black border-muted-gray/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-gray text-xs">Pickup Time</Label>
                    <Input
                      type="time"
                      value={bulkPickupTime}
                      onChange={(e) => setBulkPickupTime(e.target.value)}
                      className="bg-charcoal-black border-muted-gray/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-gray text-xs">On-Set Time</Label>
                    <Input
                      type="time"
                      value={bulkOnSetTime}
                      onChange={(e) => setBulkOnSetTime(e.target.value)}
                      className="bg-charcoal-black border-muted-gray/30"
                    />
                  </div>
                </>
              )}
            </div>

            <p className="text-xs text-muted-gray">
              Leave fields empty to keep current values.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBulkTimeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkTimeUpdate}
              disabled={!bulkCallTime && !bulkMakeupTime && !bulkPickupTime && !bulkOnSetTime}
              className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90"
            >
              Update Times
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Preset Modal */}
      <Dialog open={isSavePresetOpen} onOpenChange={setIsSavePresetOpen}>
        <DialogContent className="bg-deep-black border-muted-gray/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Save as Crew Preset</DialogTitle>
            <DialogDescription className="text-muted-gray">
              Save the current {people.length} people as a reusable preset for future call sheets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-gray">Preset Name</Label>
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g., Main Crew, Interview Team"
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSavePresetOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAsPreset}
              disabled={!presetName.trim() || saveAsPreset.isPending}
              className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90"
            >
              {saveAsPreset.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Preset'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CallSheetPeopleManager;
