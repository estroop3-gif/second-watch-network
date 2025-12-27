import React, { useState, forwardRef } from 'react';
import { X } from 'lucide-react';
import { Badge } from './badge';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export const TagInput = forwardRef<HTMLDivElement, TagInputProps>(
  ({ value, onChange, placeholder }, ref) => {
    const [inputValue, setInputValue] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        if (!value.includes(inputValue.trim())) {
          onChange([...value, inputValue.trim()]);
        }
        setInputValue('');
      } else if (e.key === 'Backspace' && !inputValue) {
        const newTags = value.slice(0, -1);
        onChange(newTags);
      }
    };

    const removeTag = (tagToRemove: string) => {
      onChange(value.filter(tag => tag !== tagToRemove));
    };

    return (
      <div ref={ref}>
        <div className="flex flex-wrap gap-2 p-2 border border-input rounded-md min-h-[40px]">
          {value.map(tag => (
            <Badge key={tag} variant="secondary" className="bg-muted-gray/50 text-bone-white hover:bg-muted-gray/70">
              {tag}
              <button
                type="button"
                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => removeTag(tag)}
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className="bg-transparent outline-none placeholder:text-muted-foreground flex-1 min-w-[120px]"
          />
        </div>
      </div>
    );
  }
);

TagInput.displayName = 'TagInput';
