interface DiscussionCategoryTabsProps {
  categories: any[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}

const DiscussionCategoryTabs = ({ categories, activeSlug, onSelect }: DiscussionCategoryTabsProps) => {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect('')}
        className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
          activeSlug === ''
            ? 'bg-accent-yellow text-charcoal-black'
            : 'text-muted-gray hover:bg-muted-gray/20'
        }`}
      >
        All
      </button>
      {categories.map((cat: any) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.slug)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            activeSlug === cat.slug
              ? 'bg-accent-yellow text-charcoal-black'
              : 'text-muted-gray hover:bg-muted-gray/20'
          }`}
        >
          {cat.name}
          {cat.thread_count > 0 && (
            <span className="ml-1.5 text-[10px] opacity-70">({cat.thread_count})</span>
          )}
        </button>
      ))}
    </div>
  );
};

export default DiscussionCategoryTabs;
