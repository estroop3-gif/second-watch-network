import { useState, useEffect } from 'react';
import { useFormDraft } from '@/hooks/useFormDraft';
import { buildDraftKey } from '@/lib/formDraftStorage';

const CONTENT_TYPES = [
  { value: 'social_media_video', label: 'Social Media Video' },
  { value: 'marketing_video', label: 'Marketing Video' },
  { value: 'graphic', label: 'Graphic' },
  { value: 'social_post', label: 'Social Post' },
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'photo_shoot', label: 'Photo Shoot' },
  { value: 'animation', label: 'Animation' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface ContentRequestFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  isLoading?: boolean;
  platforms?: any[];
  /** Called after successful submit so parent can clear draft */
  onDraftClear?: () => void;
}

const formDefaults = {
  title: '',
  contentType: 'social_media_video',
  priority: 'normal',
  description: '',
  dueDate: '',
  platformIds: [] as string[],
  referenceLinks: '',
};

const ContentRequestForm = ({ onSubmit, initialData, isLoading, platforms, onDraftClear }: ContentRequestFormProps) => {
  const isCreate = !initialData;
  const draftKey = buildDraftKey('media', 'content-request', 'new');

  // Draft persistence for create mode
  const draft = useFormDraft({
    key: draftKey,
    initialData: formDefaults,
    enabled: isCreate,
  });

  // For edit mode, use plain state seeded from initialData
  const [editForm, setEditForm] = useState(formDefaults);

  useEffect(() => {
    if (initialData) {
      setEditForm({
        title: initialData.title || '',
        contentType: initialData.content_type || 'social_media_video',
        priority: initialData.priority || 'normal',
        description: initialData.description || '',
        dueDate: initialData.due_date || '',
        platformIds: initialData.platform_ids || [],
        referenceLinks: Array.isArray(initialData.reference_links)
          ? initialData.reference_links.join('\n')
          : initialData.reference_links || '',
      });
    }
  }, [initialData]);

  // Unified accessors
  const form = isCreate ? draft.formData : editForm;
  const setForm = isCreate ? draft.setFormData : setEditForm;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const links = form.referenceLinks
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    onSubmit({
      title: form.title.trim(),
      content_type: form.contentType,
      priority: form.priority,
      description: form.description.trim() || null,
      due_date: form.dueDate || null,
      platform_ids: form.platformIds,
      reference_links: links.length > 0 ? links : null,
    });
  };

  const togglePlatform = (id: string) => {
    setForm((prev) => ({
      ...prev,
      platformIds: prev.platformIds.includes(id)
        ? prev.platformIds.filter((p) => p !== id)
        : [...prev.platformIds, id],
    }));
  };

  const inputClass =
    'w-full bg-charcoal-black border border-muted-gray/30 rounded-lg px-3 py-2 text-sm text-bone-white placeholder:text-muted-gray focus:outline-none focus:ring-1 focus:ring-accent-yellow/50';
  const labelClass = 'block text-sm font-medium text-bone-white mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className={labelClass}>
          Title <span className="text-primary-red">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Instagram Reel for Product Launch"
          required
          className={inputClass}
        />
      </div>

      {/* Content Type + Priority row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Content Type</label>
          <select
            value={form.contentType}
            onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value }))}
            className={inputClass}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Priority</label>
          <select
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            className={inputClass}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Describe what you need, any creative direction, brand guidelines, etc."
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Due Date */}
      <div>
        <label className={labelClass}>Due Date</label>
        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
          className={inputClass}
        />
      </div>

      {/* Platform Selection */}
      {platforms && platforms.length > 0 && (
        <div>
          <label className={labelClass}>Target Platforms</label>
          <div className="flex flex-wrap gap-3">
            {platforms.map((platform: any) => (
              <label
                key={platform.id}
                className="inline-flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form.platformIds.includes(platform.id)}
                  onChange={() => togglePlatform(platform.id)}
                  className="w-4 h-4 rounded border-muted-gray/50 bg-charcoal-black accent-accent-yellow"
                />
                <span className="flex items-center gap-1.5 text-sm text-bone-white">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: platform.color || '#6b7280' }}
                  />
                  {platform.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Reference Links */}
      <div>
        <label className={labelClass}>Reference Links</label>
        <textarea
          value={form.referenceLinks}
          onChange={(e) => setForm((f) => ({ ...f, referenceLinks: e.target.value }))}
          placeholder="Paste reference URLs, one per line"
          rows={3}
          className={`${inputClass} resize-none`}
        />
        <p className="mt-1 text-xs text-muted-gray">One URL per line</p>
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={!form.title.trim() || isLoading}
          className="w-full sm:w-auto px-6 py-2.5 bg-accent-yellow text-charcoal-black text-sm font-semibold rounded-lg hover:bg-accent-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Saving...' : initialData ? 'Update Request' : 'Submit Request'}
        </button>
      </div>
    </form>
  );
};

export default ContentRequestForm;
