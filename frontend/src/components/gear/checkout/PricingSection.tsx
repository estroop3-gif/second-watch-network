/**
 * Pricing Section
 * Rental pricing for client checkouts
 */
import React from 'react';
import {
  Calendar,
  DollarSign,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { SelectedItem, ItemPricing } from './CheckoutDialog';

interface PricingSectionProps {
  selectedItems: SelectedItem[];
  itemPricing: Map<string, ItemPricing>;
  onUpdatePricing: (assetId: string, updates: Partial<ItemPricing>) => void;
  rentalDays: number;
  taxRate: string;
  setTaxRate: (rate: string) => void;
  paymentOption: 'invoice_later' | 'pay_now';
  setPaymentOption: (option: 'invoice_later' | 'pay_now') => void;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export function PricingSection({
  selectedItems,
  itemPricing,
  onUpdatePricing,
  rentalDays,
  taxRate,
  setTaxRate,
  paymentOption,
  setPaymentOption,
  subtotal,
  taxAmount,
  totalAmount,
}: PricingSectionProps) {
  return (
    <div className="space-y-4">
      {/* Rental Period Info */}
      <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span className="text-sm">Rental Period</span>
        </div>
        <Badge variant="outline" className="text-blue-400 border-blue-500/30">
          {rentalDays} day{rentalDays !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Item Pricing */}
      <div className="space-y-2">
        {selectedItems.map((item) => {
          const pricing = itemPricing.get(item.id);
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-charcoal-black/30 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{item.name}</p>
                <code className="text-xs text-muted-gray">{item.internalId}</code>
                {item.dailyRate && (
                  <p className="text-xs text-muted-gray">
                    Default: ${item.dailyRate}/day
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={pricing?.rateType || 'daily'}
                  onValueChange={(v) =>
                    onUpdatePricing(item.id, {
                      rateType: v as 'daily' | 'weekly' | 'flat',
                      quantity: v === 'flat' ? 1 : rentalDays,
                    })
                  }
                >
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="flat">Flat</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-20">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-gray text-xs">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricing?.rate || 0}
                    onChange={(e) =>
                      onUpdatePricing(item.id, { rate: parseFloat(e.target.value) || 0 })
                    }
                    className="pl-5 h-8 text-xs text-right"
                  />
                </div>
                <span className="text-xs text-muted-gray w-16 text-right">
                  = ${(pricing?.lineTotal || 0).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tax & Payment */}
      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-muted-gray/20">
        <div className="space-y-2">
          <Label className="text-sm text-muted-gray">Tax Rate (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-gray">Payment</Label>
          <Select value={paymentOption} onValueChange={(v) => setPaymentOption(v as 'invoice_later' | 'pay_now')}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="invoice_later">Invoice Later</SelectItem>
              <SelectItem value="pay_now">Pay at Checkout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Totals */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-gray">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-gray">Tax ({taxRate}%)</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold border-t border-muted-gray/30 pt-2">
              <span>Total</span>
              <span className="text-blue-400">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
