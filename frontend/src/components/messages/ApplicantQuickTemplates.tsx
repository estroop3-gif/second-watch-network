/**
 * ApplicantQuickTemplates - Quick template buttons for applicant outreach
 * Displays when messaging an applicant from the applicant detail page
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Calendar, Star, FileText, Loader2 } from 'lucide-react';

interface ApplicantQuickTemplatesProps {
  recipientName: string;
  roleName: string;
  onSelectTemplate: (text: string) => void;
}

// Map template slugs to icons
const templateIcons: Record<string, React.ReactNode> = {
  interview_request: <Calendar className="h-4 w-4" />,
  express_interest: <Star className="h-4 w-4" />,
  request_materials: <FileText className="h-4 w-4" />,
};

export const ApplicantQuickTemplates = ({
  recipientName,
  roleName,
  onSelectTemplate,
}: ApplicantQuickTemplatesProps) => {
  // Fetch applicant templates from API
  const { data: templates, isLoading } = useQuery({
    queryKey: ['message-templates', 'applicant'],
    queryFn: () => api.getSystemMessageTemplates({ contextType: 'applicant' }),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Replace template variables with actual values
  const fillTemplate = (body: string): string => {
    return body
      .replace(/\{\{name\}\}/g, recipientName)
      .replace(/\{\{role\}\}/g, roleName);
  };

  const handleSelectTemplate = (template: { body: string }) => {
    const filledText = fillTemplate(template.body);
    onSelectTemplate(filledText);
  };

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-b border-muted-gray bg-charcoal-black/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading templates...</span>
        </div>
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3 border-b border-muted-gray bg-charcoal-black/50">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Quick Replies
        </p>
        <div className="flex flex-wrap gap-2">
          {templates.map((template) => (
            <Button
              key={template.slug}
              variant="outline"
              size="sm"
              onClick={() => handleSelectTemplate(template)}
              className="gap-2 bg-muted-gray/30 border-muted-gray hover:bg-muted-gray/50 hover:border-accent-yellow text-bone-white"
            >
              {templateIcons[template.slug] || <FileText className="h-4 w-4" />}
              {template.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
