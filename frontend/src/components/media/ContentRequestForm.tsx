import { useState, useEffect } from 'react';

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
}

const ContentRequestForm = ({ onSubmit, initialData, isLoading, platforms }: ContentRequestFormProps) => {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('social_media_video');
  const [priority, setPriority] = useState('normal');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [platformIds, setPlatformIds] = useState<string[]>([]);
  const [referenceLinks, setReferenceLinks] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setContentType(initialData.content_type || 'social_media_video');
      setPriority(initialData.priority || 'normal');
      setDescription(initialData.description || '');
      setDueDate(initialData.due_date || '');
      setPlatformIds(initialData.platform_ids || []);
      setReferenceLinks(
        Array.isArray(initialData.reference_links)
          ? initialData.reference_links.join('\n')
          : initialData.reference_links || ''
      );
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const links = referenceLinks
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    onSubmit({
      title: title.trim(),
      content_type: contentType,
      priority,
      description: description.trim() || null,
      due_date: dueDate || null,
      platform_ids: platformIds,
      reference_links: links.length > 0 ? links : null,
    });
  };

  const togglePlatform = (id: string) => {
    setPlatformIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
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
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
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
                  checked={platformIds.includes(platform.id)}
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
          value={referenceLinks}
          onChange={(e) => setReferenceLinks(e.target.value)}
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
          disabled={!title.trim() || isLoading}
          className="w-full sm:w-auto px-6 py-2.5 bg-accent-yellow text-charcoal-black text-sm font-semibold rounded-lg hover:bg-accent-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Saving...' : initialData ? 'Update Request' : 'Submit Request'}
        </button>
      </div>
    </form>
  );
};

export default ContentRequestForm;
