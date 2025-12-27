import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { SearchDialog } from './SearchDialog';
import { cn } from '@/lib/utils';

export const SearchBar = ({ className }: { className?: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left",
          "bg-charcoal-black border-2 border-muted-gray",
          "text-muted-gray/80 hover:text-bone-white hover:border-accent-yellow",
          "transition-colors",
          className
        )}
      >
        <Search className="h-5 w-5" />
        <span className="flex-grow">Search Second Watch...</span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-muted-gray bg-charcoal-black px-1.5 font-mono text-[10px] font-medium text-muted-gray opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <SearchDialog open={open} setOpen={setOpen} />
    </>
  );
};