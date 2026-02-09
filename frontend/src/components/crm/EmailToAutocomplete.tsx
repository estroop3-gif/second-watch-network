import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { User, Clock, Users } from 'lucide-react';
import { useEmailSuggestions } from '@/hooks/crm/useEmail';

interface EmailSuggestion {
  email: string;
  display_name: string;
  company: string | null;
  source: string;
  contact_id: string | null;
}

interface EmailToAutocompleteProps {
  value: string;
  onChange: (email: string) => void;
  onSelect?: (suggestion: EmailSuggestion) => void;
  placeholder?: string;
  className?: string;
}

const SOURCE_ICONS = {
  contact: User,
  recent: Clock,
  team: Users,
} as const;

const EmailToAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = 'recipient@example.com',
  className,
}: EmailToAutocompleteProps) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data } = useEmailSuggestions(query);
  const suggestions = data?.suggestions || [];

  const handleInputChange = useCallback((val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(val.trim());
    }, 300);
  }, [onChange]);

  useEffect(() => {
    if (suggestions.length > 0 && query.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    setHighlightedIndex(-1);
  }, [suggestions, query]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSuggestion = useCallback((suggestion: EmailSuggestion) => {
    onChange(suggestion.email);
    setIsOpen(false);
    setQuery('');
    onSelect?.(suggestion);
  }, [onChange, onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          selectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={e => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0 && query.length >= 2) setIsOpen(true); }}
        placeholder={placeholder}
        className={className || 'bg-charcoal-black border-muted-gray/50 text-bone-white'}
      />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-muted-gray/50 bg-charcoal-black shadow-lg overflow-hidden">
          {suggestions.map((s, i) => {
            const Icon = SOURCE_ICONS[s.source as keyof typeof SOURCE_ICONS] || User;
            return (
              <button
                key={`${s.email}-${s.source}`}
                type="button"
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  i === highlightedIndex ? 'bg-muted-gray/20' : 'hover:bg-muted-gray/10'
                }`}
                onMouseEnter={() => setHighlightedIndex(i)}
                onClick={() => selectSuggestion(s)}
              >
                <Icon className="h-3.5 w-3.5 text-muted-gray flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-bone-white font-medium truncate">{s.display_name}</span>
                    {s.company && (
                      <span className="text-muted-gray text-xs truncate">({s.company})</span>
                    )}
                  </div>
                  <div className="text-muted-gray text-xs truncate">{s.email}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmailToAutocomplete;
