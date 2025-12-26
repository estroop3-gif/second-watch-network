/**
 * SearchableCombobox - Reusable autocomplete component with "Add new" capability
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface SearchableItem {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface SearchableComboboxProps<T extends SearchableItem> {
  value: string | null;
  onChange: (id: string | null, item?: T) => void;
  searchFn: (query: string) => Promise<T[]>;
  onAddNew?: (name: string) => Promise<T>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  addNewLabel?: string;
  renderItem?: (item: T) => React.ReactNode;
  renderSelected?: (item: T) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  debounceMs?: number;
}

function SearchableCombobox<T extends SearchableItem>({
  value,
  onChange,
  searchFn,
  onAddNew,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  addNewLabel = 'Add new',
  renderItem,
  renderSelected,
  disabled = false,
  className,
  debounceMs = 300,
}: SearchableComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Debounced search - runs on open and on query change
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Search with query (empty query will get default list from searchFn)
        const results = await searchFn(searchQuery);
        setItems(results);
      } catch (error) {
        console.error('Search error:', error);
        setItems([]);
      } finally {
        setIsSearching(false);
      }
    }, searchQuery ? debounceMs : 0); // No delay for initial load

    return () => clearTimeout(timer);
  }, [searchQuery, open, searchFn, debounceMs]);

  // Load selected item when value changes
  useEffect(() => {
    if (value && !selectedItem) {
      // Try to find in current items
      const found = items.find((item) => item.id === value);
      if (found) {
        setSelectedItem(found);
      }
    } else if (!value) {
      setSelectedItem(null);
    }
  }, [value, items, selectedItem]);

  const handleSelect = useCallback(
    (item: T) => {
      setSelectedItem(item);
      onChange(item.id, item);
      setOpen(false);
      setSearchQuery('');
    },
    [onChange]
  );

  const handleAddNew = useCallback(async () => {
    if (!onAddNew || !searchQuery.trim()) return;

    setIsAdding(true);
    try {
      const newItem = await onAddNew(searchQuery.trim());
      setSelectedItem(newItem);
      onChange(newItem.id, newItem);
      setOpen(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error adding new item:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add item';
      toast.error(errorMessage);
    } finally {
      setIsAdding(false);
    }
  }, [onAddNew, searchQuery, onChange]);

  const handleClear = useCallback(() => {
    setSelectedItem(null);
    onChange(null);
    setSearchQuery('');
  }, [onChange]);

  // Check if search query matches any existing item exactly
  const exactMatch = items.some(
    (item) => item.name.toLowerCase() === searchQuery.toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'inline-flex items-center justify-between gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full bg-charcoal-black/50 border-muted-gray/30 text-bone-white hover:bg-charcoal-black/70',
            !selectedItem && 'text-muted-gray',
            className
          )}
        >
          {selectedItem ? (
            renderSelected ? (
              renderSelected(selectedItem)
            ) : (
              <span className="truncate">{selectedItem.name}</span>
            )
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9"
          />
          <CommandList>
            {isSearching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-gray" />
              </div>
            ) : (
              <>
                {items.length === 0 && searchQuery && !isSearching && (
                  <CommandEmpty>{emptyMessage}</CommandEmpty>
                )}
                {items.length > 0 && (
                  <CommandGroup>
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => handleSelect(item)}
                        className="cursor-pointer"
                      >
                        {renderItem ? (
                          renderItem(item)
                        ) : (
                          <span>{item.name}</span>
                        )}
                        <Check
                          className={cn(
                            'ml-auto h-4 w-4',
                            value === item.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {onAddNew && searchQuery.trim() && !exactMatch && (
                  <>
                    {items.length > 0 && <CommandSeparator />}
                    <CommandGroup>
                      <CommandItem
                        onSelect={handleAddNew}
                        disabled={isAdding}
                        className="cursor-pointer text-accent-yellow"
                      >
                        {isAdding ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        {addNewLabel} "{searchQuery}"
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
                {selectedItem && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={handleClear}
                        className="cursor-pointer text-muted-gray"
                      >
                        Clear selection
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default SearchableCombobox;
