import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { allContent, Content } from '@/data/content';
import Fuse from 'fuse.js';
import { FileVideo, Tv, User } from 'lucide-react';
import { api } from '@/lib/api';

const fuse = new Fuse(allContent, {
  keys: ['title', 'tagline', 'description', 'creator', 'tags'],
  includeScore: true,
  threshold: 0.4,
});

interface SearchDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface PersonSearchResult {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function SearchDialog({ open, setOpen }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<PersonSearchResult[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  useEffect(() => {
    if (query.length < 2) {
      setPeopleResults([]);
      return;
    }

    const searchPeople = async () => {
      try {
        const data = await api.searchUsers(query, 5);
        setPeopleResults(data || []);
      } catch (error) {
        console.error('Search error:', error);
        setPeopleResults([]);
      }
    };

    const debounce = setTimeout(() => searchPeople(), 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const runCommand = useCallback((command: () => unknown) => {
    setOpen(false);
    setQuery('');
    command();
  }, [setOpen]);

  const contentResults = query ? fuse.search(query) : allContent.map(item => ({ item, score: 1 }));

  const getIcon = (type: Content['type']) => {
    switch (type) {
      case 'Original Series': return <Tv className="h-4 w-4 text-muted-gray" />;
      case 'Documentary':
      case 'Short Film': return <FileVideo className="h-4 w-4 text-muted-gray" />;
      default: return <User className="h-4 w-4 text-muted-gray" />;
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Search content, creators, tags..." 
        value={query} 
        onValueChange={setQuery}
        className="border-b-accent-yellow focus:border-b-accent-yellow"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {peopleResults.length > 0 && (
          <CommandGroup heading="People">
            {peopleResults.map((person) => (
              <CommandItem
                key={person.username}
                value={`user-${person.username}`}
                onSelect={() => runCommand(() => navigate(`/profile/${person.username}`))}
                className="group"
              >
                <div className="flex items-center gap-4 w-full">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={person.avatar_url || undefined} />
                    <AvatarFallback>{person.full_name?.[0] || person.username?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-grow overflow-hidden">
                    <h4 className="font-heading text-bone-white truncate">{person.full_name || person.username}</h4>
                    <p className="text-sm text-muted-gray font-sans normal-case truncate">@{person.username}</p>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {contentResults.length > 0 && (
          <CommandGroup heading="Content">
            {contentResults.map(({ item }) => (
              <CommandItem
                key={item.id}
                value={item.title}
                onSelect={() => runCommand(() => navigate(item.linkTo))}
                className="group"
              >
                <div className="flex items-center gap-4 w-full">
                  <div className="w-24 h-14 bg-muted-gray/20 flex-shrink-0">
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                  </div>
                  <div className="flex-grow overflow-hidden">
                    <div className="flex items-center gap-2">
                      {getIcon(item.type)}
                      <h4 className="font-heading text-bone-white truncate">{item.title}</h4>
                    </div>
                    <p className="text-sm text-muted-gray font-sans normal-case truncate">{item.tagline}</p>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}