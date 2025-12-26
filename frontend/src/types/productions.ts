/**
 * Productions, Networks, and Related Types
 */

// Production type options
export type ProductionType =
  | 'documentary'
  | 'feature_film'
  | 'short_film'
  | 'series_episodic'
  | 'limited_series'
  | 'commercial'
  | 'music_video'
  | 'corporate_industrial'
  | 'wedding_event'
  | 'web_content'
  | 'live_event'
  | 'news_eng';

export const PRODUCTION_TYPE_LABELS: Record<ProductionType, string> = {
  documentary: 'Documentary',
  feature_film: 'Feature Film',
  short_film: 'Short Film',
  series_episodic: 'Series/Episodic (TV)',
  limited_series: 'Limited Series/Miniseries',
  commercial: 'Commercial',
  music_video: 'Music Video',
  corporate_industrial: 'Corporate/Industrial',
  wedding_event: 'Wedding/Event',
  web_content: 'Web Content/Streaming',
  live_event: 'Live Event',
  news_eng: 'News/ENG',
};

export const PRODUCTION_TYPE_OPTIONS: { value: ProductionType; label: string }[] = [
  { value: 'documentary', label: 'Documentary' },
  { value: 'feature_film', label: 'Feature Film' },
  { value: 'short_film', label: 'Short Film' },
  { value: 'series_episodic', label: 'Series/Episodic (TV)' },
  { value: 'limited_series', label: 'Limited Series/Miniseries' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'corporate_industrial', label: 'Corporate/Industrial' },
  { value: 'wedding_event', label: 'Wedding/Event' },
  { value: 'web_content', label: 'Web Content/Streaming' },
  { value: 'live_event', label: 'Live Event' },
  { value: 'news_eng', label: 'News/ENG' },
];

// Union type options
export type UnionType =
  | 'sag_aftra'
  | 'iatse'
  | 'dga'
  | 'wga'
  | 'teamsters'
  | 'non_union';

export const UNION_OPTIONS: { value: UnionType; label: string; description: string }[] = [
  { value: 'sag_aftra', label: 'SAG-AFTRA', description: 'Screen Actors Guild - American Federation of Television and Radio Artists' },
  { value: 'iatse', label: 'IATSE', description: 'International Alliance of Theatrical Stage Employees' },
  { value: 'dga', label: 'DGA', description: 'Directors Guild of America' },
  { value: 'wga', label: 'WGA', description: 'Writers Guild of America' },
  { value: 'teamsters', label: 'Teamsters', description: 'International Brotherhood of Teamsters' },
  { value: 'non_union', label: 'Non-Union', description: 'No union affiliation required' },
];

// Network category
export type NetworkCategory = 'broadcast' | 'cable' | 'streaming' | 'news' | 'specialty';

export const NETWORK_CATEGORY_LABELS: Record<NetworkCategory, string> = {
  broadcast: 'Broadcast Networks',
  cable: 'Cable & Premium',
  streaming: 'Streaming Services',
  news: 'News & Sports',
  specialty: 'Specialty Networks',
};

// TV Network
export interface TvNetwork {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  category: NetworkCategory;
  is_active: boolean;
  sort_order: number;
}

// Network category with networks
export interface NetworkCategoryGroup {
  category: NetworkCategory;
  label: string;
  networks: TvNetwork[];
}

// Production
export interface Production {
  id: string;
  name: string;
  production_type: ProductionType;
  company: string | null;
  network_id: string | null;
  backlot_project_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  network?: TvNetwork;
}

export interface ProductionInput {
  name: string;
  production_type: ProductionType;
  company?: string;
  network_id?: string;
  backlot_project_id?: string;
}

// Custom question (for job posters to add)
export interface CustomQuestion {
  id: string;
  question: string;
  required: boolean;
}

// Custom question responses (for applicants)
export interface CustomQuestionResponses {
  [questionId: string]: string;
}

// Helper to create a new custom question
export function createCustomQuestion(question: string, required: boolean = false): CustomQuestion {
  return {
    id: crypto.randomUUID(),
    question,
    required,
  };
}
