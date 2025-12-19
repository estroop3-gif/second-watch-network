/**
 * AICopilotPanel - AI assistant panel for project management
 * Provides suggestions, answers questions, and helps with production tasks
 */
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot,
  X,
  Send,
  Loader2,
  Sparkles,
  Calendar,
  ClipboardList,
  Users,
  MapPin,
  Film,
  Lightbulb,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { BacklotProject } from '@/types/backlot';
import { cn } from '@/lib/utils';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface AICopilotPanelProps {
  project: BacklotProject;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  {
    icon: <Calendar className="w-4 h-4" />,
    label: 'Create schedule',
    prompt: 'Help me create a production schedule for this project',
  },
  {
    icon: <ClipboardList className="w-4 h-4" />,
    label: 'Generate tasks',
    prompt: 'Generate a task list for pre-production',
  },
  {
    icon: <Users className="w-4 h-4" />,
    label: 'Crew suggestions',
    prompt: 'What crew positions do I need for this project?',
  },
  {
    icon: <MapPin className="w-4 h-4" />,
    label: 'Location checklist',
    prompt: 'Create a location scouting checklist',
  },
  {
    icon: <Film className="w-4 h-4" />,
    label: 'Call sheet tips',
    prompt: 'What should I include in my call sheet?',
  },
  {
    icon: <Lightbulb className="w-4 h-4" />,
    label: 'Budget tips',
    prompt: 'Give me tips for managing the production budget',
  },
];

const AICopilotPanel: React.FC<AICopilotPanelProps> = ({ project, isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hey! I'm your production co-pilot for "${project.title}". I can help you with scheduling, tasks, crew planning, and more. What do you need help with?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setShowQuickPrompts(false);
    setIsLoading(true);
    setError(null);

    try {
      // Build conversation history for context
      const conversationHistory = [...messages, userMessage]
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      // Include the new user message
      const apiMessages = conversationHistory.length > 0
        ? conversationHistory
        : [{ role: 'user', content: text }];

      // Call the backend API
      const response = await fetch(`${API_BASE}/backlot/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          project_context: {
            title: project.title,
            project_type: project.project_type,
            genre: project.genre,
            status: project.status,
            logline: project.logline,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Copilot error:', err);
      setError('Failed to get response. Please try again.');

      // Add a fallback response
      const fallbackMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment, or ask about:\n\n- **Scheduling** - Production timeline planning\n- **Tasks** - Pre-production checklists\n- **Crew** - Position recommendations\n- **Locations** - Scouting checklists\n- **Call Sheets** - Essential elements\n- **Budget** - Cost management tips",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-charcoal-black border-l border-muted-gray/30 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-muted-gray/30 flex items-center justify-between bg-muted-gray/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent-yellow/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-accent-yellow" />
          </div>
          <div>
            <h3 className="font-medium text-bone-white">AI Co-pilot</h3>
            <p className="text-xs text-muted-gray">Production Assistant</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-accent-yellow/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-accent-yellow" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  message.role === 'user'
                    ? 'bg-accent-yellow text-charcoal-black'
                    : 'bg-muted-gray/20 text-bone-white'
                )}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-accent-yellow/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-accent-yellow" />
              </div>
              <div className="bg-muted-gray/20 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-gray" />
              </div>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        {showQuickPrompts && messages.length === 1 && (
          <div className="mt-6">
            <button
              onClick={() => setShowQuickPrompts(!showQuickPrompts)}
              className="flex items-center gap-1 text-xs text-muted-gray mb-3"
            >
              <ChevronDown className="w-3 h-3" />
              Quick prompts
            </button>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSend(prompt.prompt)}
                  className="flex items-center gap-2 p-2 rounded-lg border border-muted-gray/30 hover:border-accent-yellow/50 hover:bg-muted-gray/10 transition-colors text-left"
                >
                  <span className="text-accent-yellow">{prompt.icon}</span>
                  <span className="text-xs text-bone-white">{prompt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 p-4 border-t border-muted-gray/30 bg-muted-gray/5">
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 mb-2">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask anything about your production..."
            className="flex-1 bg-charcoal-black border-muted-gray/30"
            disabled={isLoading}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-gray mt-2 text-center">
          Powered by AI. Suggestions are for guidance only.
        </p>
      </div>
    </div>
  );
};

export default AICopilotPanel;
