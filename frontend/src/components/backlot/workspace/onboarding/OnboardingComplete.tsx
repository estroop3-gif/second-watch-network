/**
 * OnboardingComplete - Success screen after completing all onboarding steps
 */
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ArrowRight, FileText, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface OnboardingCompleteProps {
  completedSteps: number;
  totalSteps: number;
  projectTitle?: string;
}

export function OnboardingComplete({ completedSteps, totalSteps, projectTitle }: OnboardingCompleteProps) {
  return (
    <div className="max-w-md mx-auto text-center space-y-6 py-12">
      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-2">Onboarding Complete</h2>
        <p className="text-muted-foreground">
          You've completed all {totalSteps} steps{projectTitle ? ` for ${projectTitle}` : ''}.
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Documents completed</span>
            </div>
            <span className="font-medium text-green-500">{completedSteps}/{totalSteps}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <Link to="/backlot">
          <Button className="w-full">
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
