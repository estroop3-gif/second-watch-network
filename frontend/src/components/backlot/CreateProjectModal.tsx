/**
 * CreateProjectModal - Modal for creating a new Backlot project
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjects } from '@/hooks/backlot';
import { BacklotVisibility } from '@/types/backlot';
import { Loader2, Lock, Eye, Globe } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

const VISIBILITY_OPTIONS: { value: BacklotVisibility; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'private',
    label: 'Private',
    description: 'Only you and invited members can see this project',
    icon: <Lock className="w-4 h-4" />,
  },
  {
    value: 'unlisted',
    label: 'Unlisted',
    description: 'Anyone with the link can view the public page',
    icon: <Eye className="w-4 h-4" />,
  },
  {
    value: 'public',
    label: 'Public',
    description: 'Visible on your profile and searchable',
    icon: <Globe className="w-4 h-4" />,
  },
];

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { createProject } = useProjects();

  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [projectType, setProjectType] = useState('film');
  const [visibility, setVisibility] = useState<BacklotVisibility>('private');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Project title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const project = await createProject.mutateAsync({
        title: title.trim(),
        logline: logline.trim() || undefined,
        project_type: projectType,
        visibility,
      });
      onClose();
      navigate(`/backlot/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Start a new production. You can add details and invite team members later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Project Title *</Label>
            <Input
              id="title"
              placeholder="My Awesome Film"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Logline */}
          <div className="space-y-2">
            <Label htmlFor="logline">Logline</Label>
            <Textarea
              id="logline"
              placeholder="A brief one-line description of your project..."
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          {/* Project Type */}
          <div className="space-y-2">
            <Label htmlFor="project-type">Project Type</Label>
            <Select value={projectType} onValueChange={setProjectType} disabled={isSubmitting}>
              <SelectTrigger id="project-type">
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

          {/* Visibility */}
          <div className="space-y-3">
            <Label>Visibility</Label>
            <div className="space-y-2">
              {VISIBILITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    visibility === option.value
                      ? 'border-accent-yellow bg-accent-yellow/10'
                      : 'border-muted-gray/30 hover:border-muted-gray/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={option.value}
                    checked={visibility === option.value}
                    onChange={(e) => setVisibility(e.target.value as BacklotVisibility)}
                    className="sr-only"
                    disabled={isSubmitting}
                  />
                  <div className="mt-0.5 text-muted-gray">{option.icon}</div>
                  <div>
                    <div className="font-medium text-bone-white">{option.label}</div>
                    <div className="text-sm text-muted-gray">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectModal;
