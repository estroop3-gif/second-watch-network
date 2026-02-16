import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { X, User, Clock, Users } from 'lucide-react';
import { useEmailSuggestions } from '@/hooks/crm/useEmail';

interface EmailSuggestion {
  email: string;
  display_name: string;
  company: string | null;
  source: string;
  contact_id: string | null;
}

interface EmailChipInputProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  onSelectSuggestion?: (suggestion: EmailSuggestion) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SOURCE_ICONS = {
  contact: User,
  recent: Clock,
  team: Users,
} as const;

const EmailChipInput = ({
  emails,
  onChange,
  onSelectSuggestion,
  placeholder = 'recipient@example.com',
  className,
  autoFocus,
}: EmailChipInputProps) => {
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [flashEmail, setFlashEmail] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data } = useEmailSuggestions(query);
  const suggestions = (data?.suggestions || []).filter(
    (s: EmailSuggestion) => !emails.includes(s.email)
  );

  const addEmail = useCallback((email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return false;
    if (!EMAIL_REGEX.test(trimmed)) return false;
    if (emails.includes(trimmed)) {
      // Flash the existing chip
      setFlashEmail(trimmed);
      setTimeout(() => setFlashEmail(null), 600);
      setInputValue('');
      return false;
    }
    onChange([...emails, trimmed]);
    setInputValue('');
    setQuery('');
    setIsOpen(false);
    return true;
  }, [emails, onChange]);

  const addMultipleEmails = useCallback((text: string) => {
    const parts = text.split(/[,;\n\r\t]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
    const newEmails: string[] = [];
    let lastInvalid = '';
    for (const part of parts) {
      if (EMAIL_REGEX.test(part) && !emails.includes(part) && !newEmails.includes(part)) {
        newEmails.push(part);
      } else if (!EMAIL_REGEX.test(part)) {
        lastInvalid = part;
      }
    }
    if (newEmails.length > 0) {
      onChange([...emails, ...newEmails]);
    }
    setInputValue(lastInvalid);
    setQuery('');
    setIsOpen(false);
  }, [emails, onChange]);

  const removeEmail = useCallback((email: string) => {
    onChange(emails.filter(e => e !== email));
  }, [emails, onChange]);

  const selectSuggestion = useCallback((suggestion: EmailSuggestion) => {
    const trimmed = suggestion.email.trim().toLowerCase();
    if (emails.includes(trimmed)) {
      setFlashEmail(trimmed);
      setTimeout(() => setFlashEmail(null), 600);
      setInputValue('');
      setQuery('');
      setIsOpen(false);
      return;
    }
    onChange([...emails, trimmed]);
    setInputValue('');
    setQuery('');
    setIsOpen(false);
    onSelectSuggestion?.(suggestion);
    inputRef.current?.focus();
  }, [emails, onChange, onSelectSuggestion]);

  const handleInputChange = useCallback((val: string) => {
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(val.trim());
    }, 300);
  }, []);

  useEffect(() => {
    if (suggestions.length > 0 && query.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    setHighlightedIndex(-1);
  }, [suggestions.length, query]);

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // If suggestions are open and user navigates
    if (isOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        return;
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          e.preventDefault();
          selectSuggestion(suggestions[highlightedIndex]);
          return;
        }
      }
    }

    // Chip triggers: Enter, Tab, Comma
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (inputValue.trim()) {
        e.preventDefault();
        addEmail(inputValue);
      }
      return;
    }

    if (e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addEmail(inputValue);
      }
      return;
    }

    // Backspace on empty input removes last chip
    if (e.key === 'Backspace' && inputValue === '' && emails.length > 0) {
      removeEmail(emails[emails.length - 1]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.includes(',') || pastedText.includes(';') || pastedText.includes('\n')) {
      e.preventDefault();
      addMultipleEmails(pastedText);
    }
  };

  const handleBlur = () => {
    // Small delay so click on suggestion can register
    setTimeout(() => {
      if (inputValue.trim() && EMAIL_REGEX.test(inputValue.trim())) {
        addEmail(inputValue);
      }
    }, 150);
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={className || 'flex flex-wrap items-center gap-1 min-h-[36px] px-2 py-1 rounded-md border bg-charcoal-black border-muted-gray/50 focus-within:ring-1 focus-within:ring-accent-yellow/50 cursor-text'}
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map(email => (
          <span
            key={email}
            className={`inline-flex items-center gap-1 bg-muted-gray/20 text-bone-white rounded-full px-2 py-0.5 text-xs transition-all ${
              flashEmail === email ? 'ring-2 ring-accent-yellow animate-pulse' : ''
            }`}
          >
            {email}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeEmail(email); }}
              className="text-muted-gray hover:text-red-400 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          onFocus={() => { if (suggestions.length > 0 && query.length >= 2) setIsOpen(true); }}
          placeholder={emails.length === 0 ? placeholder : ''}
          autoFocus={autoFocus}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-bone-white text-sm placeholder:text-muted-gray"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-muted-gray/50 bg-charcoal-black shadow-lg overflow-hidden max-h-[200px] overflow-y-auto">
          {suggestions.map((s: EmailSuggestion, i: number) => {
            const Icon = SOURCE_ICONS[s.source as keyof typeof SOURCE_ICONS] || User;
            return (
              <button
                key={`${s.email}-${s.source}`}
                type="button"
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  i === highlightedIndex ? 'bg-muted-gray/20' : 'hover:bg-muted-gray/10'
                }`}
                onMouseEnter={() => setHighlightedIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
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

export default EmailChipInput;
