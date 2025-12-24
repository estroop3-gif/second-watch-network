/**
 * SceneSelect - Dropdown to select a scene from the project
 */
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useScenesList } from '@/hooks/backlot';
import { Skeleton } from '@/components/ui/skeleton';
import { Film } from 'lucide-react';

interface SceneSelectProps {
  projectId: string;
  value: string | null;
  onChange: (sceneId: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function SceneSelect({
  projectId,
  value,
  onChange,
  label = 'Scene',
  placeholder = 'Select scene (optional)',
  disabled = false,
  className,
}: SceneSelectProps) {
  const { data: scenes, isLoading } = useScenesList(projectId);

  if (isLoading) {
    return (
      <div className={className}>
        {label && <Label className="text-muted-gray text-xs mb-1.5 block">{label}</Label>}
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!scenes || scenes.length === 0) {
    return (
      <div className={className}>
        {label && <Label className="text-muted-gray text-xs mb-1.5 block">{label}</Label>}
        <div className="flex items-center gap-2 text-muted-gray text-sm p-2 border border-muted-gray/20 rounded-md bg-charcoal-black/30">
          <Film className="w-4 h-4" />
          <span>No scenes available</span>
        </div>
      </div>
    );
  }

  // Sort scenes by scene number
  const sortedScenes = [...scenes].sort((a, b) => {
    const numA = parseFloat(a.scene_number) || 0;
    const numB = parseFloat(b.scene_number) || 0;
    return numA - numB;
  });

  return (
    <div className={className}>
      {label && <Label className="text-muted-gray text-xs mb-1.5 block">{label}</Label>}
      <Select
        value={value || 'none'}
        onValueChange={(val) => onChange(val === 'none' ? null : val)}
        disabled={disabled}
      >
        <SelectTrigger className="bg-charcoal-black border-muted-gray/20 text-bone-white">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-rich-black border-muted-gray/20 max-h-[300px]">
          <SelectItem value="none" className="text-muted-gray">
            {placeholder}
          </SelectItem>
          {sortedScenes.map((scene) => (
            <SelectItem
              key={scene.id}
              value={scene.id}
              className="text-bone-white hover:bg-charcoal-black"
            >
              <div className="flex items-center gap-2">
                <span className="text-accent-yellow font-mono text-sm min-w-[40px]">
                  {scene.scene_number}
                </span>
                <span className="truncate text-sm">
                  {scene.slugline || 'Untitled Scene'}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
