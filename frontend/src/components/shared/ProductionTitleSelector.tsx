/**
 * ProductionTitleSelector - Searchable autocomplete for backlot projects
 * Searches backlot projects and allows creating new unlisted ones
 */
import React from 'react';
import { Film, Clapperboard } from 'lucide-react';
import SearchableCombobox, { SearchableItem } from './SearchableCombobox';
import { useAuth } from '@/context/AuthContext';

interface BacklotProject extends SearchableItem {
  id: string;
  name: string;
  project_type?: string;
  visibility?: string;
  thumbnail_url?: string;
}

interface ProductionTitleSelectorProps {
  value: string | null;
  onChange: (id: string | null, project?: BacklotProject) => void;
  disabled?: boolean;
  className?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

const PROJECT_TYPE_LABELS: Record<string, string> = {
  feature: 'Feature Film',
  short: 'Short Film',
  series: 'Series',
  documentary: 'Documentary',
  commercial: 'Commercial',
  music_video: 'Music Video',
  other: 'Other',
};

const ProductionTitleSelector: React.FC<ProductionTitleSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const { session } = useAuth();

  const searchProjects = async (query: string): Promise<BacklotProject[]> => {
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Build URL - empty query gets public projects, with query searches user's + public
      const url = query?.trim()
        ? `${API_BASE}/api/v1/backlot/projects/search/for-collab?q=${encodeURIComponent(query)}&limit=20`
        : `${API_BASE}/api/v1/backlot/projects/search/for-collab?limit=20`;

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.warn(`Projects search failed (${response.status}): ${errorText}`);
        return [];
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('Projects search error:', error.message);
      }
      return [];
    }
  };

  const createProject = async (name: string): Promise<BacklotProject> => {
    if (!session?.access_token) {
      throw new Error('Please log in to add a production');
    }

    const response = await fetch(`${API_BASE}/api/v1/backlot/projects/quick-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ title: name }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please refresh and try again');
      }
      if (response.status === 409) {
        throw new Error('Production already exists');
      }
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || 'Failed to create production');
    }

    return await response.json();
  };

  const renderItem = (project: BacklotProject) => (
    <div className="flex items-center gap-2">
      {project.thumbnail_url ? (
        <img
          src={project.thumbnail_url}
          alt={project.name}
          className="h-6 w-6 rounded object-cover"
        />
      ) : (
        <Clapperboard className="h-4 w-4 text-muted-gray" />
      )}
      <div className="flex flex-col">
        <span className="text-bone-white">{project.name}</span>
        {project.project_type && (
          <span className="text-[10px] text-muted-gray">
            {PROJECT_TYPE_LABELS[project.project_type] || project.project_type}
          </span>
        )}
      </div>
    </div>
  );

  const renderSelected = (project: BacklotProject) => (
    <div className="flex items-center gap-2 truncate">
      {project.thumbnail_url ? (
        <img
          src={project.thumbnail_url}
          alt={project.name}
          className="h-5 w-5 rounded object-cover flex-shrink-0"
        />
      ) : (
        <Clapperboard className="h-4 w-4 text-muted-gray flex-shrink-0" />
      )}
      <span className="truncate">{project.name}</span>
    </div>
  );

  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      searchFn={searchProjects}
      onAddNew={createProject}
      placeholder="Search or add production..."
      searchPlaceholder="Type production title..."
      emptyMessage="No productions found."
      addNewLabel="Add production"
      renderItem={renderItem}
      renderSelected={renderSelected}
      disabled={disabled}
      className={className}
    />
  );
};

export default ProductionTitleSelector;
