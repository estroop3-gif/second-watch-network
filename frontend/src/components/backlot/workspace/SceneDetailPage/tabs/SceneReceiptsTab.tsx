/**
 * SceneReceiptsTab - Receipts for the scene (direct + inherited from location)
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SceneHubData } from '@/hooks/backlot';
import { Receipt, Plus, MapPin, Building, Calendar, DollarSign, Paperclip } from 'lucide-react';

interface SceneReceiptsTabProps {
  hub: SceneHubData;
  canEdit: boolean;
  projectId: string;
  sceneId: string;
}

export default function SceneReceiptsTab({
  hub,
  canEdit,
  projectId,
  sceneId,
}: SceneReceiptsTabProps) {
  const { receipts, receipts_from_location, budget_summary } = hub;
  const hasReceipts = receipts.length > 0 || receipts_from_location.length > 0;
  const totalReceipts = receipts.length + receipts_from_location.length;
  const totalAmount = [...receipts, ...receipts_from_location].reduce(
    (sum, r) => sum + r.amount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-green-400" />
            <span className="text-2xl font-bold text-bone-white">{totalReceipts}</span>
            <span className="text-muted-gray">receipts</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-2xl font-bold text-bone-white">
              ${totalAmount.toLocaleString()}
            </span>
            <span className="text-muted-gray">total</span>
          </div>
        </div>
        {canEdit && (
          <Button className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Receipt
          </Button>
        )}
      </div>

      {/* Direct Receipts */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-bone-white flex items-center gap-2">
              <Building className="w-5 h-5 text-green-400" />
              Scene Receipts ({receipts.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <p className="text-center text-muted-gray py-6">
              No receipts directly linked to this scene
            </p>
          ) : (
            <div className="space-y-3">
              {receipts.map((receipt) => (
                <ReceiptRow key={receipt.id} receipt={receipt} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inherited from Location */}
      {receipts_from_location.length > 0 && (
        <Card className="bg-charcoal-black border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-bone-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Inherited from Location ({receipts_from_location.length})
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 ml-2">
                Read-only
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {receipts_from_location.map((receipt) => (
                <ReceiptRow key={receipt.id} receipt={receipt} isInherited />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!hasReceipts && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="py-12 text-center">
            <Receipt className="w-12 h-12 mx-auto mb-4 text-muted-gray opacity-50" />
            <p className="text-muted-gray">No receipts for this scene</p>
            <p className="text-sm text-muted-gray/60 mt-1">
              Attach receipts directly or link a location with receipts
            </p>
            {canEdit && (
              <Button variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Receipt
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReceiptRow({
  receipt,
  isInherited = false,
}: {
  receipt: {
    id: string;
    description: string;
    vendor_name: string | null;
    amount: number;
    receipt_date: string | null;
    category_name: string | null;
    has_attachment: boolean;
  };
  isInherited?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        isInherited
          ? 'bg-cyan-500/5 border-cyan-500/20'
          : 'bg-muted-gray/5 border-muted-gray/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-bone-white">{receipt.description}</p>
            {receipt.has_attachment && (
              <Paperclip className="w-4 h-4 text-muted-gray" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {receipt.vendor_name && (
              <span className="text-sm text-muted-gray">{receipt.vendor_name}</span>
            )}
            {receipt.category_name && (
              <Badge variant="outline" className="text-xs">
                {receipt.category_name}
              </Badge>
            )}
            {receipt.receipt_date && (
              <span className="text-xs text-muted-gray flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(receipt.receipt_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-medium text-green-400">${receipt.amount.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
