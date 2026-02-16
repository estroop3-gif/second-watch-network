import { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Minus, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import EmailComposer from '@/components/crm/EmailComposer';
import { useEmailAccount } from '@/hooks/crm/useEmail';

export interface ComposeOptions {
  defaultTo?: string | string[];
  defaultCc?: string | string[];
  defaultBcc?: string | string[];
  defaultSubject?: string;
  defaultBody?: string;
  contactId?: string;
  threadId?: string;
  isDNC?: boolean;
  /** Quoted thread content for reply */
  quotedHtml?: string;
  quotedLabel?: string;
  /** Contact data for template variable resolution */
  contactData?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    email?: string;
    deal_name?: string;
  };
}

interface EmailComposeContextType {
  isOpen: boolean;
  isMinimized: boolean;
  composeOptions: ComposeOptions;
  openCompose: (options?: ComposeOptions) => void;
  closeCompose: () => void;
  minimizeCompose: () => void;
  expandCompose: () => void;
}

const EmailComposeContext = createContext<EmailComposeContextType>({
  isOpen: false,
  isMinimized: false,
  composeOptions: {},
  openCompose: () => {},
  closeCompose: () => {},
  minimizeCompose: () => {},
  expandCompose: () => {},
});

export const useEmailCompose = () => useContext(EmailComposeContext);

export const EmailComposeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [composeOptions, setComposeOptions] = useState<ComposeOptions>({});
  const { data: account } = useEmailAccount();

  const openCompose = useCallback((options?: ComposeOptions) => {
    setComposeOptions(options || {});
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const closeCompose = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setComposeOptions({});
  }, []);

  const minimizeCompose = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const expandCompose = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const subjectLine = composeOptions.defaultSubject || 'New Message';

  return (
    <EmailComposeContext.Provider value={{ isOpen, isMinimized, composeOptions, openCompose, closeCompose, minimizeCompose, expandCompose }}>
      {children}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed bottom-0 right-6 z-50 w-[560px] rounded-t-lg border border-b-0 border-muted-gray/50 bg-charcoal-black shadow-2xl flex flex-col',
              isMinimized ? 'h-auto' : 'max-h-[80vh]'
            )}
          >
            {/* Title bar */}
            <div
              className="flex items-center justify-between px-4 py-2.5 bg-muted-gray/20 rounded-t-lg cursor-pointer select-none border-b border-muted-gray/30"
              onClick={() => isMinimized ? expandCompose() : minimizeCompose()}
            >
              <span className="text-sm font-medium text-accent-yellow truncate pr-4">
                {subjectLine}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); isMinimized ? expandCompose() : minimizeCompose(); }}
                  className="p-1 rounded hover:bg-muted-gray/30 text-muted-gray hover:text-bone-white transition-colors"
                  title={isMinimized ? 'Expand' : 'Minimize'}
                >
                  {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); closeCompose(); }}
                  className="p-1 rounded hover:bg-muted-gray/30 text-muted-gray hover:text-bone-white transition-colors"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Body - hidden when minimized */}
            {!isMinimized && (
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs text-muted-gray mb-3">
                  Send from {account?.email_address || 'your CRM account'}
                </p>
                <EmailComposer
                  defaultTo={composeOptions.defaultTo}
                  defaultCc={composeOptions.defaultCc}
                  defaultBcc={composeOptions.defaultBcc}
                  defaultSubject={composeOptions.defaultSubject}
                  defaultBody={composeOptions.defaultBody}
                  threadId={composeOptions.threadId}
                  contactId={composeOptions.contactId}
                  isDNC={composeOptions.isDNC}
                  contactData={composeOptions.contactData}
                  quotedHtml={composeOptions.quotedHtml}
                  quotedLabel={composeOptions.quotedLabel}
                  onSent={() => closeCompose()}
                  onCancel={closeCompose}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </EmailComposeContext.Provider>
  );
};
