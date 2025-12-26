/**
 * CustomQuestionsAnswerer - For applicants to answer custom screening questions
 */
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomQuestion, CustomQuestionResponses } from '@/types/productions';

interface CustomQuestionsAnswererProps {
  questions: CustomQuestion[];
  responses: CustomQuestionResponses;
  onChange: (responses: CustomQuestionResponses) => void;
  onReport?: () => void;
}

const CustomQuestionsAnswerer: React.FC<CustomQuestionsAnswererProps> = ({
  questions,
  responses,
  onChange,
  onReport,
}) => {
  if (!questions || questions.length === 0) {
    return null;
  }

  const updateResponse = (questionId: string, answer: string) => {
    onChange({
      ...responses,
      [questionId]: answer,
    });
  };

  // Check if all required questions are answered
  const requiredQuestions = questions.filter((q) => q.required);
  const unansweredRequired = requiredQuestions.filter(
    (q) => !responses[q.id]?.trim()
  );

  return (
    <div className="space-y-4">
      {/* Legal Notice */}
      <div className="p-3 bg-amber-900/20 border border-amber-600/30 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-200 font-medium">
              Custom Poster Questions
            </p>
            <p className="text-xs text-amber-200/80 mt-1">
              These questions were created by the job poster, not Second Watch Network.
              Questions should be relevant to the position and comply with employment laws.
              {onReport && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={onReport}
                  className="text-amber-400 hover:text-amber-300 p-0 h-auto ml-1"
                >
                  <Flag className="w-3 h-3 mr-1" />
                  Report inappropriate questions
                </Button>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="space-y-2">
            <Label className="text-bone-white flex items-center gap-2">
              <span className="text-xs text-muted-gray">Q{index + 1}.</span>
              <span>{question.question}</span>
              {question.required && (
                <span className="text-red-400 text-xs">*</span>
              )}
            </Label>
            <Textarea
              value={responses[question.id] || ''}
              onChange={(e) => updateResponse(question.id, e.target.value)}
              placeholder="Your answer..."
              className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray min-h-[80px]"
            />
            {question.required && !responses[question.id]?.trim() && (
              <p className="text-xs text-red-400">This question requires an answer</p>
            )}
          </div>
        ))}
      </div>

      {/* Validation message */}
      {unansweredRequired.length > 0 && (
        <p className="text-xs text-amber-400">
          {unansweredRequired.length} required question
          {unansweredRequired.length !== 1 ? 's' : ''} remaining
        </p>
      )}
    </div>
  );
};

export default CustomQuestionsAnswerer;
