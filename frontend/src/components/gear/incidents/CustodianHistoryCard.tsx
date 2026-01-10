/**
 * Custodian History Card
 * Shows transaction history with recommended custodian for strike assignment
 */
import React from 'react';
import { format } from 'date-fns';
import { User, Star, Calendar, ArrowRight, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AssetCustodianHistory } from '@/types/gear';

interface CustodianHistoryCardProps {
  custodians: AssetCustodianHistory[];
  recommendedCustodian: AssetCustodianHistory | null;
  onAssignStrike?: (userId: string, userName: string) => void;
  className?: string;
}

export function CustodianHistoryCard({
  custodians,
  recommendedCustodian,
  onAssignStrike,
  className,
}: CustodianHistoryCardProps) {
  if (custodians.length === 0) {
    return (
      <Card className={cn('bg-charcoal-black/50 border-muted-gray/30', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
            <User className="w-4 h-4 text-muted-gray" />
            Custodian History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-gray text-center py-4">
            No custodian history available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-charcoal-black/50 border-muted-gray/30', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
            <User className="w-4 h-4 text-muted-gray" />
            Custodian History (Last 30 Days)
          </CardTitle>
          <span className="text-xs text-muted-gray">{custodians.length} records</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {custodians.map((custodian, index) => {
          const isRecommended = custodian.is_recommended;

          return (
            <div
              key={`${custodian.transaction_id}-${index}`}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg border',
                isRecommended
                  ? 'bg-accent-yellow/5 border-accent-yellow/30'
                  : 'bg-charcoal-black/30 border-muted-gray/20'
              )}
            >
              {/* Left side - User info */}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isRecommended ? 'bg-accent-yellow/20' : 'bg-muted-gray/20'
                  )}
                >
                  {isRecommended ? (
                    <Star className="w-4 h-4 text-accent-yellow" />
                  ) : (
                    <User className="w-4 h-4 text-muted-gray" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'font-medium text-sm',
                        isRecommended ? 'text-accent-yellow' : 'text-bone-white'
                      )}
                    >
                      {custodian.user_name}
                    </span>
                    {isRecommended && (
                      <Badge className="text-[10px] py-0 px-1.5 bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
                        Recommended
                      </Badge>
                    )}
                  </div>

                  {/* Date range */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-gray mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {custodian.checkout_at
                        ? format(new Date(custodian.checkout_at), 'MMM d')
                        : 'Unknown'}
                    </span>
                    <ArrowRight className="w-3 h-3" />
                    <span>
                      {custodian.checkin_at
                        ? format(new Date(custodian.checkin_at), 'MMM d, yyyy')
                        : 'Still out'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side - Condition & Action */}
              <div className="flex items-center gap-3">
                {custodian.return_condition && (
                  <span
                    className={cn(
                      'text-xs',
                      custodian.return_condition.toLowerCase().includes('damage')
                        ? 'text-red-400'
                        : 'text-muted-gray'
                    )}
                  >
                    {custodian.return_condition}
                  </span>
                )}

                {onAssignStrike && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAssignStrike(custodian.user_id, custodian.user_name)}
                    className={cn(
                      'text-xs h-7',
                      isRecommended
                        ? 'border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/10'
                        : 'border-muted-gray/30 text-muted-gray hover:text-bone-white'
                    )}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Strike
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default CustodianHistoryCard;
