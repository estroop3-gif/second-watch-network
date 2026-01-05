/**
 * SectionTogglePanel
 * Panel showing hidden sections that can be re-enabled
 */

import React from 'react';
import { useDashboardSettings } from '@/context/DashboardSettingsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function SectionTogglePanel() {
  const {
    hiddenSections,
    setSectionVisibility,
  } = useDashboardSettings();

  const [isOpen, setIsOpen] = React.useState(false);

  if (hiddenSections.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-6">
      <Card className="bg-muted-gray/5 border-dashed border-muted-gray/30">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted-gray/10 transition-colors py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-gray flex items-center gap-2">
                <EyeOff className="h-4 w-4" />
                Hidden Sections ({hiddenSections.length})
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-gray" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-gray" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {hiddenSections.map((section) => (
                <div
                  key={section.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    'bg-charcoal-black/50 border border-muted-gray/20',
                    'hover:border-muted-gray/40 transition-colors'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-bone-white truncate">
                      {section.title}
                    </div>
                    {section.description && (
                      <div className="text-xs text-muted-gray truncate">
                        {section.description}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSectionVisibility(section.id, true)}
                    className="ml-2 h-8 w-8 p-0 flex-shrink-0"
                    title="Show section"
                  >
                    <Eye className="h-4 w-4 text-accent-yellow" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
