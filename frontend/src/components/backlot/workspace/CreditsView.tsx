/**
 * CreditsView - Manage project credits and team roles
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Award,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
  Eye,
  EyeOff,
  User,
  ExternalLink,
  GripVertical,
  Loader2,
} from 'lucide-react';
import {
  useCredits,
  useCreditsByDepartment,
  CREDIT_DEPARTMENTS,
  CREDIT_ROLES,
} from '@/hooks/backlot';
import { BacklotProjectCredit, ProjectCreditInput } from '@/types/backlot';
import { cn } from '@/lib/utils';

interface CreditsViewProps {
  projectId: string;
  canEdit: boolean;
}

const CreditsView: React.FC<CreditsViewProps> = ({ projectId, canEdit }) => {
  const { credits, isLoading, createCredit, updateCredit, deleteCredit, togglePrimary, togglePublic } = useCredits(projectId);
  const { groupedCredits, departments } = useCreditsByDepartment(projectId);

  const [showForm, setShowForm] = useState(false);
  const [editingCredit, setEditingCredit] = useState<BacklotProjectCredit | null>(null);
  const [formData, setFormData] = useState<ProjectCreditInput>({
    name: '',
    credit_role: '',
    department: '',
    is_primary: false,
    is_public: true,
    endorsement_note: '',
    imdb_id: '',
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.credit_role) return;

    if (editingCredit) {
      await updateCredit.mutateAsync({
        id: editingCredit.id,
        project_id: projectId,
        ...formData,
      });
    } else {
      await createCredit.mutateAsync({
        project_id: projectId,
        ...formData,
      });
    }

    setShowForm(false);
    setEditingCredit(null);
    setFormData({
      name: '',
      credit_role: '',
      department: '',
      is_primary: false,
      is_public: true,
      endorsement_note: '',
      imdb_id: '',
    });
  };

  const handleEdit = (credit: BacklotProjectCredit) => {
    setEditingCredit(credit);
    setFormData({
      name: credit.name,
      credit_role: credit.credit_role,
      department: credit.department || '',
      is_primary: credit.is_primary,
      is_public: credit.is_public,
      endorsement_note: credit.endorsement_note || '',
      imdb_id: credit.imdb_id || '',
      user_id: credit.user_id || undefined,
    });
    setShowForm(true);
  };

  const handleDelete = async (credit: BacklotProjectCredit) => {
    if (!confirm(`Remove ${credit.name} from credits?`)) return;
    await deleteCredit.mutateAsync({ id: credit.id, project_id: projectId });
  };

  const availableRoles = formData.department
    ? CREDIT_ROLES[formData.department] || ['Other']
    : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-24" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white flex items-center gap-2">
            <Award className="w-6 h-6 text-accent-yellow" />
            Credits
          </h2>
          <p className="text-sm text-muted-gray">
            {credits.length} credit{credits.length !== 1 ? 's' : ''} listed
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditingCredit(null);
              setFormData({
                name: '',
                credit_role: '',
                department: '',
                is_primary: false,
                is_public: true,
                endorsement_note: '',
                imdb_id: '',
              });
              setShowForm(true);
            }}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Credit
          </Button>
        )}
      </div>

      {/* Credits by Department */}
      {credits.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-muted-gray/30 rounded-lg">
          <Award className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No credits yet</h3>
          <p className="text-muted-gray mb-4">Add team members and their roles</p>
          {canEdit && (
            <Button
              onClick={() => setShowForm(true)}
              variant="outline"
              className="border-accent-yellow text-accent-yellow hover:bg-accent-yellow/10"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Credit
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Primary Credits (above the line) */}
          {credits.some((c) => c.is_primary) && (
            <div>
              <h3 className="text-lg font-medium text-accent-yellow mb-4 flex items-center gap-2">
                <Star className="w-5 h-5" />
                Primary Credits
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {credits
                  .filter((c) => c.is_primary)
                  .map((credit) => (
                    <CreditCard
                      key={credit.id}
                      credit={credit}
                      canEdit={canEdit}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onTogglePrimary={(isPrimary) =>
                        togglePrimary.mutate({ id: credit.id, is_primary: isPrimary, project_id: projectId })
                      }
                      onTogglePublic={(isPublic) =>
                        togglePublic.mutate({ id: credit.id, is_public: isPublic, project_id: projectId })
                      }
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Credits by Department */}
          {departments.map((dept) => {
            const deptCredits = groupedCredits[dept].filter((c) => !c.is_primary);
            if (deptCredits.length === 0) return null;

            return (
              <div key={dept}>
                <h3 className="text-lg font-medium text-bone-white mb-4">{dept}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deptCredits.map((credit) => (
                    <CreditCard
                      key={credit.id}
                      credit={credit}
                      canEdit={canEdit}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onTogglePrimary={(isPrimary) =>
                        togglePrimary.mutate({ id: credit.id, is_primary: isPrimary, project_id: projectId })
                      }
                      onTogglePublic={(isPublic) =>
                        togglePublic.mutate({ id: credit.id, is_public: isPublic, project_id: projectId })
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Credit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCredit ? 'Edit Credit' : 'Add Credit'}</DialogTitle>
            <DialogDescription>
              {editingCredit
                ? 'Update the credit information'
                : 'Add a new team member to the credits'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name as it should appear"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(v) => setFormData({ ...formData, department: v, credit_role: '' })}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDIT_DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.credit_role}
                  onValueChange={(v) => setFormData({ ...formData, credit_role: v })}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.length > 0 ? (
                      availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="custom" disabled>
                        Select a department first
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endorsement">Endorsement Note (optional)</Label>
              <Input
                id="endorsement"
                value={formData.endorsement_note}
                onChange={(e) => setFormData({ ...formData, endorsement_note: e.target.value })}
                placeholder="e.g., Academy Award Winner, Emmy Nominee"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imdb">IMDB ID (optional)</Label>
              <Input
                id="imdb"
                value={formData.imdb_id}
                onChange={(e) => setFormData({ ...formData, imdb_id: e.target.value })}
                placeholder="nm1234567"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_primary"
                  checked={formData.is_primary}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
                />
                <Label htmlFor="is_primary" className="text-sm">
                  Primary Credit (above the line)
                </Label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_public"
                  checked={formData.is_public}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                />
                <Label htmlFor="is_public" className="text-sm">
                  Show on public project page
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.credit_role || createCredit.isPending || updateCredit.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {(createCredit.isPending || updateCredit.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingCredit ? 'Save Changes' : 'Add Credit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Credit Card Component
interface CreditCardProps {
  credit: BacklotProjectCredit;
  canEdit: boolean;
  onEdit: (credit: BacklotProjectCredit) => void;
  onDelete: (credit: BacklotProjectCredit) => void;
  onTogglePrimary: (isPrimary: boolean) => void;
  onTogglePublic: (isPublic: boolean) => void;
}

const CreditCard: React.FC<CreditCardProps> = ({
  credit,
  canEdit,
  onEdit,
  onDelete,
  onTogglePrimary,
  onTogglePublic,
}) => {
  return (
    <div
      className={cn(
        'bg-charcoal-black/50 border rounded-lg p-4 transition-colors',
        credit.is_primary
          ? 'border-accent-yellow/50'
          : 'border-muted-gray/20 hover:border-muted-gray/40'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="w-12 h-12">
          {credit.linked_user?.avatar_url ? (
            <AvatarImage src={credit.linked_user.avatar_url} />
          ) : null}
          <AvatarFallback>
            <User className="w-6 h-6 text-muted-gray" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-bone-white truncate">{credit.name}</h4>
              <p className="text-sm text-accent-yellow">{credit.credit_role}</p>
            </div>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(credit)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onTogglePrimary(!credit.is_primary)}>
                    <Star className="w-4 h-4 mr-2" />
                    {credit.is_primary ? 'Remove Primary' : 'Make Primary'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onTogglePublic(!credit.is_public)}>
                    {credit.is_public ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-2" />
                        Hide from Public
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Show on Public Page
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(credit)}
                    className="text-red-400 focus:text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {credit.endorsement_note && (
            <p className="text-xs text-muted-gray mt-1 italic">{credit.endorsement_note}</p>
          )}

          <div className="flex items-center gap-2 mt-2">
            {credit.is_primary && (
              <Badge variant="outline" className="text-xs border-accent-yellow/50 text-accent-yellow">
                <Star className="w-3 h-3 mr-1" />
                Primary
              </Badge>
            )}
            {!credit.is_public && (
              <Badge variant="outline" className="text-xs border-muted-gray/50 text-muted-gray">
                <EyeOff className="w-3 h-3 mr-1" />
                Hidden
              </Badge>
            )}
            {credit.imdb_id && (
              <a
                href={`https://www.imdb.com/name/${credit.imdb_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-gray hover:text-accent-yellow flex items-center gap-1"
              >
                IMDB
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditsView;
