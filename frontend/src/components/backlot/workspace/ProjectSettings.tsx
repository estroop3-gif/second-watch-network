/**
 * ProjectSettings - Project configuration, visibility, and danger zone
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Settings,
  Lock,
  Eye,
  Globe,
  Trash2,
  Loader2,
  Save,
  ExternalLink,
  Copy,
  Check,
  HardDrive,
  Key,
  ArrowRight,
} from 'lucide-react';
import { useProjects } from '@/hooks/backlot';
import {
  BacklotProject,
  BacklotVisibility,
  BacklotProjectStatus,
  ProjectInput,
} from '@/types/backlot';
import { cn } from '@/lib/utils';

interface ProjectSettingsProps {
  project: BacklotProject;
  permission: {
    canView: boolean;
    canEdit: boolean;
    isAdmin: boolean;
    isOwner: boolean;
    role: string | null;
  } | null;
}

const STATUS_OPTIONS: { value: BacklotProjectStatus; label: string }[] = [
  { value: 'pre_production', label: 'Pre-Production' },
  { value: 'production', label: 'Production' },
  { value: 'post_production', label: 'Post-Production' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'archived', label: 'Archived' },
];

const VISIBILITY_OPTIONS: {
  value: BacklotVisibility;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'private',
    label: 'Private',
    description: 'Only you and invited team members can access this project',
    icon: <Lock className="w-5 h-5" />,
  },
  {
    value: 'unlisted',
    label: 'Unlisted',
    description: 'Anyone with the link can view the public project page',
    icon: <Eye className="w-5 h-5" />,
  },
  {
    value: 'public',
    label: 'Public',
    description: 'Visible on your profile and searchable by others',
    icon: <Globe className="w-5 h-5" />,
  },
];

const PROJECT_TYPES = [
  { value: 'film', label: 'Film' },
  { value: 'series', label: 'Series' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'short', label: 'Short Film' },
  { value: 'web_series', label: 'Web Series' },
  { value: 'other', label: 'Other' },
];

const ProjectSettings: React.FC<ProjectSettingsProps> = ({ project, permission }) => {
  const navigate = useNavigate();
  const { updateProject, deleteProject } = useProjects();

  const [formData, setFormData] = useState<ProjectInput>({
    title: project.title,
    logline: project.logline || '',
    description: project.description || '',
    project_type: project.project_type || 'film',
    genre: project.genre || '',
    format: project.format || '',
    runtime_minutes: project.runtime_minutes || undefined,
    status: project.status,
    visibility: project.visibility,
    target_start_date: project.target_start_date || '',
    target_end_date: project.target_end_date || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const publicUrl = `${window.location.origin}/projects/${project.slug}`;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProject.mutateAsync({
        id: project.id,
        ...formData,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProject.mutateAsync(project.id);
      navigate('/backlot');
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyPublicUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const hasChanges =
    formData.title !== project.title ||
    formData.logline !== (project.logline || '') ||
    formData.description !== (project.description || '') ||
    formData.project_type !== (project.project_type || 'film') ||
    formData.genre !== (project.genre || '') ||
    formData.format !== (project.format || '') ||
    formData.runtime_minutes !== (project.runtime_minutes || undefined) ||
    formData.status !== project.status ||
    formData.visibility !== project.visibility ||
    formData.target_start_date !== (project.target_start_date || '') ||
    formData.target_end_date !== (project.target_end_date || '');

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading text-bone-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-accent-yellow" />
          Project Settings
        </h2>
        <p className="text-sm text-muted-gray">Configure your project details and visibility</p>
      </div>

      {/* Basic Info */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-bone-white">Basic Information</h3>

        <div className="space-y-2">
          <Label htmlFor="title">Project Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="logline">Logline</Label>
          <Textarea
            id="logline"
            placeholder="A one-line summary of your project..."
            value={formData.logline}
            onChange={(e) => setFormData({ ...formData, logline: e.target.value })}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="A longer description of your project..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="project_type">Project Type</Label>
            <Select
              value={formData.project_type}
              onValueChange={(v) => setFormData({ ...formData, project_type: v })}
            >
              <SelectTrigger id="project_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="genre">Genre</Label>
            <Input
              id="genre"
              placeholder="e.g., Drama, Comedy"
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <Input
              id="format"
              placeholder="e.g., Feature, Short"
              value={formData.format}
              onChange={(e) => setFormData({ ...formData, format: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="runtime">Runtime (minutes)</Label>
            <Input
              id="runtime"
              type="number"
              min={0}
              value={formData.runtime_minutes || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  runtime_minutes: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>
      </section>

      {/* Status & Dates */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-bone-white">Status & Timeline</h3>

        <div className="space-y-2">
          <Label htmlFor="status">Project Status</Label>
          <Select
            value={formData.status}
            onValueChange={(v) => setFormData({ ...formData, status: v as BacklotProjectStatus })}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_date">Target Start Date</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.target_start_date}
              onChange={(e) => setFormData({ ...formData, target_start_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">Target End Date</Label>
            <Input
              id="end_date"
              type="date"
              value={formData.target_end_date}
              onChange={(e) => setFormData({ ...formData, target_end_date: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Visibility */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-bone-white">Visibility</h3>
        <p className="text-sm text-muted-gray">
          Control who can see your project and its public page.
        </p>

        <div className="space-y-3">
          {VISIBILITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                formData.visibility === option.value
                  ? 'border-accent-yellow bg-accent-yellow/10'
                  : 'border-muted-gray/30 hover:border-muted-gray/50'
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={option.value}
                checked={formData.visibility === option.value}
                onChange={(e) =>
                  setFormData({ ...formData, visibility: e.target.value as BacklotVisibility })
                }
                className="sr-only"
              />
              <div className="text-muted-gray mt-0.5">{option.icon}</div>
              <div>
                <div className="font-medium text-bone-white">{option.label}</div>
                <div className="text-sm text-muted-gray">{option.description}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Public URL */}
        {(formData.visibility === 'public' || formData.visibility === 'unlisted') && (
          <div className="bg-muted-gray/10 rounded-lg p-4">
            <Label className="text-sm text-muted-gray mb-2 block">Public Page URL</Label>
            <div className="flex gap-2">
              <Input value={publicUrl} readOnly className="bg-charcoal-black/50 text-sm" />
              <Button variant="outline" size="icon" onClick={copyPublicUrl}>
                {copiedUrl ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
        {hasChanges && <span className="text-sm text-muted-gray">You have unsaved changes</span>}
      </div>

      {/* Desktop Helper */}
      <section className="space-y-4 border-t border-muted-gray/30 pt-8 mt-8">
        <h3 className="text-lg font-medium text-bone-white flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-accent-yellow" />
          Desktop Helper
        </h3>
        <p className="text-sm text-muted-gray">
          Connect the SWN Dailies Helper to upload footage directly from set.
        </p>

        <div className="bg-muted-gray/10 rounded-lg p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="bg-accent-yellow/20 p-2 rounded-lg">
              <Key className="w-5 h-5 text-accent-yellow" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-bone-white">Connect Your Desktop</h4>
              <ol className="text-sm text-muted-gray mt-2 space-y-1 list-decimal list-inside">
                <li>Download SWN Dailies Helper from our website</li>
                <li>Create an API key in your account settings</li>
                <li>Enter the key in the helper's setup wizard</li>
              </ol>
            </div>
          </div>

          <Button asChild variant="outline" className="w-full">
            <Link to="/account?tab=api-keys" className="flex items-center justify-center gap-2">
              <Key className="w-4 h-4" />
              Manage API Keys
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Danger Zone */}
      {permission?.isOwner && (
        <section className="space-y-4 border-t border-red-500/30 pt-8 mt-8">
          <h3 className="text-lg font-medium text-red-400">Danger Zone</h3>
          <p className="text-sm text-muted-gray">
            Permanently delete this project and all its data. This action cannot be undone.
          </p>

          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Project
          </Button>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{project.title}</strong> and all its data
                  including:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>All production days and call sheets</li>
                    <li>All tasks and assignments</li>
                    <li>All locations and gear records</li>
                    <li>All updates and contacts</li>
                    <li>All team member associations</li>
                  </ul>
                  <p className="mt-4 font-medium text-red-400">This action cannot be undone.</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Project'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      )}
    </div>
  );
};

export default ProjectSettings;
