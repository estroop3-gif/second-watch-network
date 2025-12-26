/**
 * CustomQuestionsBuilder - Allows job posters to add custom screening questions
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, GripVertical, HelpCircle } from 'lucide-react';
import { CustomQuestion, createCustomQuestion } from '@/types/productions';

interface CustomQuestionsBuilderProps {
  questions: CustomQuestion[];
  onChange: (questions: CustomQuestion[]) => void;
  maxQuestions?: number;
}

const CustomQuestionsBuilder: React.FC<CustomQuestionsBuilderProps> = ({
  questions,
  onChange,
  maxQuestions = 5,
}) => {
  const addQuestion = () => {
    if (questions.length >= maxQuestions) return;
    onChange([...questions, createCustomQuestion('', false)]);
  };

  const updateQuestion = (index: number, updates: Partial<CustomQuestion>) => {
    const updated = questions.map((q, i) =>
      i === index ? { ...q, ...updates } : q
    );
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const updated = [...questions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-bone-white font-medium">Custom Screening Questions</Label>
          <HelpCircle
            className="w-4 h-4 text-muted-gray cursor-help"
            title={`Add up to ${maxQuestions} custom questions for applicants to answer. These should be job-relevant and comply with employment laws.`}
          />
        </div>
        <span className="text-xs text-muted-gray">
          {questions.length}/{maxQuestions} questions
        </span>
      </div>

      {questions.length === 0 ? (
        <div className="p-4 border border-dashed border-muted-gray/30 rounded-lg text-center">
          <p className="text-sm text-muted-gray mb-3">
            No custom questions added yet
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addQuestion}
            className="border-muted-gray/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Question
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="flex gap-2 items-start p-3 bg-charcoal-black/30 border border-muted-gray/20 rounded-lg"
            >
              {/* Drag handle / position */}
              <div className="flex flex-col gap-1 pt-2">
                <button
                  type="button"
                  onClick={() => moveQuestion(index, 'up')}
                  disabled={index === 0}
                  className="text-muted-gray hover:text-bone-white disabled:opacity-30"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              </div>

              {/* Question content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-gray">Q{index + 1}</span>
                </div>
                <Input
                  value={question.question}
                  onChange={(e) => updateQuestion(index, { question: e.target.value })}
                  placeholder="Enter your question..."
                  className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`required-${question.id}`}
                      checked={question.required}
                      onCheckedChange={(checked) =>
                        updateQuestion(index, { required: checked })
                      }
                      className="scale-75"
                    />
                    <Label
                      htmlFor={`required-${question.id}`}
                      className="text-xs text-muted-gray cursor-pointer"
                    >
                      Required
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(index)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-7 px-2"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {questions.length > 0 && questions.length < maxQuestions && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addQuestion}
          className="w-full border-dashed border-muted-gray/30 text-muted-gray hover:text-bone-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Another Question
        </Button>
      )}

      {questions.length > 0 && (
        <div className="p-3 bg-amber-900/20 border border-amber-600/30 rounded-lg">
          <p className="text-xs text-amber-200/80">
            <strong>Note:</strong> Ensure your questions are job-relevant and comply with
            employment laws. Avoid questions about protected characteristics such as age,
            race, religion, gender, or disability status.
          </p>
        </div>
      )}
    </div>
  );
};

export default CustomQuestionsBuilder;
