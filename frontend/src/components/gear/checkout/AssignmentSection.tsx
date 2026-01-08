/**
 * Assignment Section
 * Custodian, project, dates, location, and notes
 * Projects load dynamically based on selected custodian
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  UserPlus,
  Calendar,
  MapPin,
  Plus,
  FolderOpen,
  FileText,
  Loader2,
  Check,
  Link2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

import type { GearOrganizationMember, GearLocation, LinkedProject } from '@/types/gear';
import type { CreateContactInput, GearContact } from '@/hooks/gear';
import { useGearMemberProjects, useGearContactProjects } from '@/hooks/gear';
import { LocationDialog } from '../clients/LocationDialog';

interface AssignmentSectionProps {
  mode: 'team' | 'client';
  orgId: string;
  custodianId: string;
  setCustodianId: (id: string) => void;
  custodianContactId: string;
  setCustodianContactId: (id: string) => void;
  projectId: string;
  setProjectId: (id: string) => void;
  checkoutDate: string;
  setCheckoutDate: (date: string) => void;
  expectedReturnDate: string;
  setExpectedReturnDate: (date: string) => void;
  destinationLocationId: string;
  setDestinationLocationId: (id: string) => void;
  notes: string;
  setNotes: (notes: string) => void;
  members: GearOrganizationMember[];
  contacts: GearContact[];
  locations: GearLocation[];
  createContact: { mutateAsync: (data: CreateContactInput) => Promise<{ contact: GearContact }>; isPending: boolean };
  onLocationsChange?: () => void; // Callback to refresh locations after creating
}

export function AssignmentSection({
  mode,
  orgId,
  custodianId,
  setCustodianId,
  custodianContactId,
  setCustodianContactId,
  projectId,
  setProjectId,
  checkoutDate,
  setCheckoutDate,
  expectedReturnDate,
  setExpectedReturnDate,
  destinationLocationId,
  setDestinationLocationId,
  notes,
  setNotes,
  members,
  contacts,
  locations,
  createContact,
  onLocationsChange,
}: AssignmentSectionProps) {
  // Quick add forms
  const [showAddContact, setShowAddContact] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [newContactName, setNewContactName] = useState({ first: '', last: '' });

  // Find selected contact to check for linked user
  const selectedContact = useMemo(() => {
    if (mode !== 'client' || !custodianContactId) return null;
    return contacts.find((c) => c.id === custodianContactId);
  }, [mode, custodianContactId, contacts]);

  const linkedUserId = selectedContact?.linked_user_id;

  // Fetch projects dynamically based on custodian
  const { data: memberProjects, isLoading: memberProjectsLoading } = useGearMemberProjects(
    orgId,
    mode === 'team' && custodianId ? custodianId : null
  );

  const { data: contactProjects, isLoading: contactProjectsLoading } = useGearContactProjects(
    orgId,
    mode === 'client' && custodianContactId && linkedUserId ? custodianContactId : null
  );

  // Combined projects list based on mode
  const availableProjects = useMemo(() => {
    if (mode === 'team') {
      return memberProjects || [];
    } else if (mode === 'client') {
      return contactProjects || [];
    }
    return [];
  }, [mode, memberProjects, contactProjects]);

  const projectsLoading = mode === 'team' ? memberProjectsLoading : contactProjectsLoading;

  // Clear project selection when custodian changes and project no longer available
  useEffect(() => {
    if (projectId && availableProjects.length > 0) {
      const projectStillAvailable = availableProjects.some((p) => p.id === projectId);
      if (!projectStillAvailable) {
        setProjectId('');
      }
    }
  }, [availableProjects, projectId, setProjectId]);

  // Handle quick add contact
  const handleAddContact = async () => {
    if (!newContactName.first || !newContactName.last) return;
    try {
      const result = await createContact.mutateAsync({
        first_name: newContactName.first,
        last_name: newContactName.last,
      });
      setCustodianContactId(result.contact.id);
      setShowAddContact(false);
      setNewContactName({ first: '', last: '' });
    } catch (err) {
      console.error('Failed to create contact:', err);
    }
  };

  // Handle location created from dialog
  const handleLocationCreated = (locationId: string) => {
    setDestinationLocationId(locationId);
    setIsLocationDialogOpen(false);
    onLocationsChange?.();
  };

  return (
    <div className="space-y-4">
      {/* Custodian Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <User className="w-4 h-4" />
            {mode === 'team' ? 'Team Member' : 'Client'} <span className="text-red-400">*</span>
          </Label>
          {mode === 'client' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddContact(!showAddContact)}
              className="text-accent-yellow hover:text-accent-yellow/80"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Add Person
            </Button>
          )}
        </div>

        {mode === 'team' ? (
          <Select value={custodianId || 'none'} onValueChange={(v) => setCustodianId(v === 'none' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select team member..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select a member</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  <div className="flex items-center gap-2">
                    <span>{member.display_name || member.email}</span>
                    <Badge variant="outline" className="text-xs">{member.role}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            <Select value={custodianContactId || 'none'} onValueChange={(v) => setCustodianContactId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select client..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select a client</SelectItem>
                {contacts.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-gray text-center">
                    No contacts yet
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      <div className="flex items-center gap-2">
                        <span>{contact.first_name} {contact.last_name}</span>
                        {contact.company && (
                          <Badge variant="outline" className="text-xs">{contact.company}</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {/* Quick Add Contact Form */}
            {showAddContact && (
              <div className="p-3 bg-charcoal-black/30 rounded-lg space-y-2 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="First name"
                    value={newContactName.first}
                    onChange={(e) => setNewContactName((prev) => ({ ...prev, first: e.target.value }))}
                  />
                  <Input
                    placeholder="Last name"
                    value={newContactName.last}
                    onChange={(e) => setNewContactName((prev) => ({ ...prev, last: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddContact}
                    disabled={!newContactName.first || !newContactName.last || createContact.isPending}
                  >
                    {createContact.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    Add
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddContact(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Project Link */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-muted-gray">
          <FolderOpen className="w-4 h-4" />
          Link to Project (optional)
        </Label>

        {/* Show message for client mode when no linked user */}
        {mode === 'client' && custodianContactId && !linkedUserId && (
          <div className="flex items-center gap-2 text-xs text-muted-gray bg-charcoal-black/30 p-2 rounded">
            <Link2 className="w-3 h-3" />
            <span>
              Client not linked to platform account. Link them in the Clients tab to see their projects.
            </span>
          </div>
        )}

        {/* Show message for client mode with linked user */}
        {mode === 'client' && custodianContactId && linkedUserId && selectedContact && (
          <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 p-2 rounded">
            <Link2 className="w-3 h-3" />
            <span>
              Showing projects for {selectedContact.linked_user_name || 'linked user'}
            </span>
          </div>
        )}

        <Select
          value={projectId || 'none'}
          onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}
          disabled={projectsLoading || (mode === 'client' && !linkedUserId)}
        >
          <SelectTrigger>
            {projectsLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading projects...
              </div>
            ) : (
              <SelectValue placeholder="Select project..." />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {availableProjects.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-gray text-center">
                {mode === 'team' && !custodianId
                  ? 'Select a team member first'
                  : mode === 'client' && !linkedUserId
                    ? 'Client not linked to platform'
                    : 'No active projects found'}
              </div>
            ) : (
              availableProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <span>{project.name}</span>
                    {project.status && (
                      <Badge variant="outline" className="text-xs">
                        {project.status.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    {project.role && (
                      <Badge variant="secondary" className="text-xs">{project.role}</Badge>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-muted-gray">
            <Calendar className="w-4 h-4" />
            Checkout Date
          </Label>
          <Input
            type="date"
            value={checkoutDate}
            onChange={(e) => setCheckoutDate(e.target.value)}
          />
          <p className="text-xs text-muted-gray">Empty = today</p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-muted-gray">
            <Calendar className="w-4 h-4" />
            Expected Return
          </Label>
          <Input
            type="date"
            value={expectedReturnDate}
            onChange={(e) => setExpectedReturnDate(e.target.value)}
            min={checkoutDate || format(new Date(), 'yyyy-MM-dd')}
          />
        </div>
      </div>

      {/* Destination Location */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-muted-gray">
            <MapPin className="w-4 h-4" />
            Destination (optional)
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsLocationDialogOpen(true)}
            className="text-accent-yellow hover:text-accent-yellow/80"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Location
          </Button>
        </div>
        <Select value={destinationLocationId || 'none'} onValueChange={(v) => setDestinationLocationId(v === 'none' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select destination..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No specific location</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                <div className="flex items-center gap-2">
                  <span>{loc.name}</span>
                  {loc.location_type && loc.location_type !== 'other' && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {loc.location_type.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Location Dialog */}
        <LocationDialog
          isOpen={isLocationDialogOpen}
          onClose={() => setIsLocationDialogOpen(false)}
          orgId={orgId}
          onCreated={handleLocationCreated}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-muted-gray">
          <FileText className="w-4 h-4" />
          Notes (optional)
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes..."
          rows={2}
        />
      </div>
    </div>
  );
}
