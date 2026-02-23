/**
 * WrapCostReviewModal - Review crew labor costs before recording to Actual Budget
 *
 * Shows per-crew breakdown with regular, OT1, and OT2 hours/costs.
 * PM can approve (record to budget) or skip.
 */
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { useRecordSessionLabor } from '@/hooks/backlot';

interface WrapCostCrewItem {
  crew_id: string;
  display_name: string;
  department: string | null;
  rate_type: string;
  rate_amount: number;
  regular_hours: number;
  regular_cost: number;
  ot1_hours: number;
  ot1_cost: number;
  ot2_hours: number;
  ot2_cost: number;
  total_cost: number;
  has_rate: boolean;
}

interface WrapCostPreviewData {
  session_id: string;
  day_type: string;
  total_hours: number;
  regular_hours: number;
  ot1_hours: number;
  ot2_hours: number;
  crew: WrapCostCrewItem[];
  crew_with_rates: number;
  skipped_no_rate: number;
  total_cost: number;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  preview: WrapCostPreviewData | null;
}

export default function WrapCostReviewModal({ open, onClose, sessionId, preview }: Props) {
  const recordLabor = useRecordSessionLabor(sessionId);

  const handleRecord = async () => {
    try {
      await recordLabor.mutateAsync();
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  if (!preview) return null;

  const crewWithCosts = preview.crew.filter((c) => c.has_rate);
  const crewWithoutRates = preview.crew.filter((c) => !c.has_rate);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-zinc-900 border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-400" />
            Wrap Cost Review
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Review crew labor costs before recording to the Actual Budget.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Bar */}
        <div className="flex items-center gap-4 p-3 bg-zinc-800 rounded-lg">
          <div className="flex items-center gap-1.5 text-sm text-zinc-300">
            <Clock className="h-4 w-4" />
            <span>{preview.total_hours}h total</span>
          </div>
          <Badge variant="outline" className="text-xs border-zinc-600">
            {preview.day_type}
          </Badge>
          {preview.ot1_hours > 0 && (
            <Badge className="bg-yellow-600/20 text-yellow-400 text-xs">
              OT1: {preview.ot1_hours}h
            </Badge>
          )}
          {preview.ot2_hours > 0 && (
            <Badge className="bg-red-600/20 text-red-400 text-xs">
              OT2: {preview.ot2_hours}h
            </Badge>
          )}
          <div className="ml-auto text-lg font-bold text-green-400">
            ${preview.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Crew Table */}
        {crewWithCosts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-700">
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-1">Dept</th>
                  <th className="text-right py-2 px-1">Rate</th>
                  <th className="text-right py-2 px-1">Regular</th>
                  <th className="text-right py-2 px-1">OT1 (1.5x)</th>
                  <th className="text-right py-2 px-1">OT2 (2x)</th>
                  <th className="text-right py-2 px-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {crewWithCosts.map((crew) => (
                  <tr key={crew.crew_id} className="border-b border-zinc-800 text-zinc-300">
                    <td className="py-2 px-2 text-bone-white font-medium">{crew.display_name}</td>
                    <td className="py-2 px-1 text-zinc-400 text-xs">{crew.department || '—'}</td>
                    <td className="py-2 px-1 text-right text-zinc-400">
                      ${crew.rate_amount}/{crew.rate_type === 'hourly' ? 'hr' : crew.rate_type === 'daily' ? 'day' : crew.rate_type}
                    </td>
                    <td className="py-2 px-1 text-right">
                      ${crew.regular_cost.toFixed(2)}
                      <span className="text-zinc-500 text-xs ml-1">({crew.regular_hours}h)</span>
                    </td>
                    <td className="py-2 px-1 text-right">
                      {crew.ot1_cost > 0 ? (
                        <span className="text-yellow-400">
                          ${crew.ot1_cost.toFixed(2)}
                          <span className="text-zinc-500 text-xs ml-1">({crew.ot1_hours}h)</span>
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-2 px-1 text-right">
                      {crew.ot2_cost > 0 ? (
                        <span className="text-red-400">
                          ${crew.ot2_cost.toFixed(2)}
                          <span className="text-zinc-500 text-xs ml-1">({crew.ot2_hours}h)</span>
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-bone-white">
                      ${crew.total_cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-600 text-bone-white font-semibold">
                  <td colSpan={6} className="py-2 px-2 text-right">Day Total:</td>
                  <td className="py-2 px-2 text-right text-green-400 text-lg">
                    ${preview.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Crew Without Rates Warning */}
        {crewWithoutRates.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-yellow-400 font-medium">
                {crewWithoutRates.length} crew member{crewWithoutRates.length > 1 ? 's' : ''} without rates
              </p>
              <p className="text-zinc-400 mt-0.5">
                {crewWithoutRates.map((c) => c.display_name).join(', ')}
              </p>
            </div>
          </div>
        )}

        {preview.error && (
          <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-red-400 text-sm">
            Error: {preview.error}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400">
            Skip
          </Button>
          <Button
            onClick={handleRecord}
            disabled={recordLabor.isPending || preview.total_cost === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {recordLabor.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-1" />
                Record to Actual Budget
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
