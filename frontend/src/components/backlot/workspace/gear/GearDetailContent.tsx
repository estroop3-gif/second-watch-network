/**
 * GearDetailContent - Main content display for gear item details
 *
 * Displays comprehensive information organized into sections:
 * - Header with name, badges, actions
 * - Quick info card
 * - Rental order details (if rental)
 * - Work order status (if exists)
 * - Organization contact
 * - Action buttons
 */
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  MoreVertical,
  Edit,
  ListTodo,
  Trash2,
  FileText,
  Wrench,
  Building2,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  MessageCircle,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
} from 'lucide-react';
import {
  getRentalStatusColor,
  getRentalStatusLabel,
  getWorkOrderStatusColor,
  getWorkOrderStatusLabel,
  getCurrentStatusIndex,
  RENTAL_ORDER_STATUSES,
  formatDate,
  formatDateTime,
  calculateRentalDays,
  getDaysUntil,
  isOverdue,
} from '@/utils/gearStatus';

interface Props {
  gear: any;
  rentalOrder?: any;
  workOrder?: any;
  organization?: any;
  marketplaceSettings?: any;
  assignee?: any;
  assignedDay?: any;
  onEdit: () => void;
  onClose: () => void;
}

export function GearDetailContent({
  gear,
  rentalOrder,
  workOrder,
  organization,
  marketplaceSettings,
  assignee,
  assignedDay,
  onEdit,
  onClose,
}: Props) {
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);

  const isRental = !gear.is_owned;
  const rentalDays = rentalOrder
    ? calculateRentalDays(rentalOrder.rental_start_date, rentalOrder.rental_end_date)
    : 0;

  return (
    <div className="py-6">
      {/* Header Section */}
      <div className="mb-6 px-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-bone-white flex items-center gap-2 mb-1">
              <Package className="w-6 h-6" />
              {gear.name}
            </h2>
            {gear.category && (
              <p className="text-sm text-muted-gray">{gear.category}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ListTodo className="w-4 h-4 mr-2" />
                Create Task
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-500">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {isRental && (
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
              RENTAL
            </Badge>
          )}
          {gear.status && (
            <Badge variant="outline" className="capitalize">
              {gear.status.replace('_', ' ')}
            </Badge>
          )}
          {gear.is_owned && (
            <Badge variant="outline" className="bg-green-500/20 text-green-400">
              OWNED
            </Badge>
          )}
        </div>
      </div>

      <div className="px-6 space-y-4">
        {/* Quick Info Card */}
        <Card className="p-4 bg-charcoal-black/50 border-muted-gray/20">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {gear.serial_number && (
              <div>
                <span className="text-muted-gray block mb-1">Serial Number:</span>
                <p className="text-bone-white font-mono">{gear.serial_number}</p>
              </div>
            )}
            <div>
              <span className="text-muted-gray block mb-1">Ownership:</span>
              <p className="text-bone-white">
                {gear.is_owned ? 'Owned' : `Rental from ${gear.rental_house || 'External'}`}
              </p>
            </div>
            {gear.asset_tag && (
              <div>
                <span className="text-muted-gray block mb-1">Asset Tag:</span>
                <p className="text-bone-white font-mono">{gear.asset_tag}</p>
              </div>
            )}
            {assignee && (
              <div>
                <span className="text-muted-gray block mb-1">Assigned To:</span>
                <p className="text-bone-white">{assignee.display_name || assignee.full_name}</p>
              </div>
            )}
          </div>
          {gear.description && (
            <div className="mt-3 pt-3 border-t border-muted-gray/20">
              <span className="text-muted-gray text-sm block mb-1">Description:</span>
              <p className="text-bone-white text-sm">{gear.description}</p>
            </div>
          )}
        </Card>

        {/* Rental Order Section */}
        {rentalOrder && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-bone-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Rental Order #{rentalOrder.order_number}
            </h3>

            {/* Status Card */}
            <Card className="p-4 bg-charcoal-black/50 border-muted-gray/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-gray">Status</span>
                <Badge className={getRentalStatusColor(rentalOrder.status)}>
                  {getRentalStatusLabel(rentalOrder.status)}
                </Badge>
              </div>

              {/* Status Progression */}
              <div className="relative mb-4">
                <div className="flex items-center justify-between">
                  {RENTAL_ORDER_STATUSES.map((status, idx) => {
                    const currentIdx = getCurrentStatusIndex(rentalOrder.status);
                    const isActive = currentIdx >= idx;

                    return (
                      <div key={status} className="flex flex-col items-center flex-1">
                        <div
                          className={`w-3 h-3 rounded-full mb-2 ${
                            isActive ? 'bg-blue-500' : 'bg-muted-gray/30'
                          }`}
                        />
                        <span className="text-xs text-muted-gray text-center leading-tight">
                          {status.split('_').join(' ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-1.5 left-0 right-0 h-0.5 bg-muted-gray/20 -z-10" />
              </div>

              {/* Timeline */}
              <div className="space-y-2 text-sm">
                {rentalOrder.built_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-muted-gray">Built:</span>
                    <span className="text-bone-white">{formatDateTime(rentalOrder.built_at)}</span>
                  </div>
                )}
                {rentalOrder.packed_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-muted-gray">Packed:</span>
                    <span className="text-bone-white">{formatDateTime(rentalOrder.packed_at)}</span>
                  </div>
                )}
                {rentalOrder.picked_up_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-muted-gray">Picked Up:</span>
                    <span className="text-bone-white">{formatDateTime(rentalOrder.picked_up_at)}</span>
                  </div>
                )}
                {rentalOrder.returned_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-muted-gray">Returned:</span>
                    <span className="text-bone-white">{formatDateTime(rentalOrder.returned_at)}</span>
                  </div>
                )}
              </div>

              {/* Rental Period */}
              <Separator className="my-4" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-gray">Pickup Date:</span>
                  <span className="text-bone-white">{formatDate(rentalOrder.rental_start_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-gray">Return Date:</span>
                  <div className="text-right">
                    <span className="text-bone-white">{formatDate(rentalOrder.rental_end_date)}</span>
                    {getDaysUntil(rentalOrder.rental_end_date) >= 0 && (
                      <p className="text-xs text-muted-gray mt-1">
                        {getDaysUntil(rentalOrder.rental_end_date) === 0
                          ? 'Due today'
                          : `${getDaysUntil(rentalOrder.rental_end_date)} days remaining`}
                      </p>
                    )}
                    {isOverdue(rentalOrder.rental_end_date) && (
                      <p className="text-xs text-red-400 mt-1">
                        {Math.abs(getDaysUntil(rentalOrder.rental_end_date))} days overdue
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-gray">Duration:</span>
                  <span className="text-bone-white">{rentalDays} days</span>
                </div>
              </div>
            </Card>

            {/* Pricing Breakdown */}
            <Card className="p-4 bg-charcoal-black/50 border-muted-gray/20">
              <h4 className="text-sm font-semibold text-bone-white mb-3">Pricing Details</h4>

              <div className="space-y-2 text-sm">
                {/* Base Rental */}
                {rentalOrder.subtotal && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Subtotal:</span>
                    <span className="text-bone-white">${rentalOrder.subtotal.toFixed(2)}</span>
                  </div>
                )}

                {/* Fees */}
                {rentalOrder.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Tax:</span>
                    <span className="text-bone-white">${rentalOrder.tax_amount.toFixed(2)}</span>
                  </div>
                )}

                {rentalOrder.insurance_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Insurance:</span>
                    <span className="text-bone-white">${rentalOrder.insurance_amount.toFixed(2)}</span>
                  </div>
                )}

                {rentalOrder.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Delivery:</span>
                    <span className="text-bone-white">${rentalOrder.delivery_fee.toFixed(2)}</span>
                  </div>
                )}

                {/* Adjustments */}
                {rentalOrder.damage_charges > 0 && (
                  <div className="flex justify-between text-orange-400">
                    <span>Damage Charges:</span>
                    <span>+${rentalOrder.damage_charges.toFixed(2)}</span>
                  </div>
                )}

                {rentalOrder.late_fees > 0 && (
                  <div className="flex justify-between text-orange-400">
                    <span>Late Fees:</span>
                    <span>+${rentalOrder.late_fees.toFixed(2)}</span>
                  </div>
                )}

                {/* Total */}
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold text-base">
                  <span className="text-bone-white">Total:</span>
                  <span className="text-accent-yellow">
                    ${((rentalOrder.final_amount || rentalOrder.total_amount) || 0).toFixed(2)}
                  </span>
                </div>

                {/* Rate Display */}
                {gear.rental_cost_per_day && (
                  <div className="mt-3 pt-3 border-t border-muted-gray/20">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-gray">Daily Rate:</span>
                      <span className="text-bone-white">${gear.rental_cost_per_day}/day</span>
                    </div>
                    {gear.rental_weekly_rate && (
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-muted-gray">Weekly Rate:</span>
                        <span className="text-bone-white">${gear.rental_weekly_rate}/week</span>
                      </div>
                    )}
                    {gear.rental_monthly_rate && (
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-muted-gray">Monthly Rate:</span>
                        <span className="text-bone-white">${gear.rental_monthly_rate}/month</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Order Items */}
            {rentalOrder.items && rentalOrder.items.length > 0 && (
              <Card className="p-4 bg-charcoal-black/50 border-muted-gray/20">
                <h4 className="text-sm font-semibold text-bone-white mb-3">Order Items</h4>
                <div className="space-y-2">
                  {rentalOrder.items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm p-2 rounded bg-charcoal-black/30"
                    >
                      <span className="text-bone-white">{item.asset_name || item.item_description}</span>
                      <div className="flex items-center gap-3 text-muted-gray">
                        <span>Qty: {item.quantity}</span>
                        {item.quoted_rate && (
                          <span>${item.quoted_rate}/{item.rate_type || 'day'}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Work Order Section */}
        {workOrder && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-bone-white flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Work Order {workOrder.reference_number}
            </h3>

            <Card className="p-4 bg-charcoal-black/50 border-muted-gray/20">
              <div className="flex items-center justify-between mb-3">
                <Badge className={getWorkOrderStatusColor(workOrder.status)}>
                  {getWorkOrderStatusLabel(workOrder.status)}
                </Badge>
                {workOrder.item_count > 0 && (
                  <span className="text-sm text-muted-gray">
                    {workOrder.staged_count || 0} of {workOrder.item_count} staged
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {workOrder.item_count > 0 && (
                <div className="w-full bg-muted-gray/20 rounded-full h-2 mb-3">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${((workOrder.staged_count || 0) / workOrder.item_count) * 100}%`,
                    }}
                  />
                </div>
              )}

              {/* Assignment Info */}
              {workOrder.assigned_to_name && (
                <div className="text-sm mb-2">
                  <span className="text-muted-gray">Assigned to: </span>
                  <span className="text-bone-white">{workOrder.assigned_to_name}</span>
                </div>
              )}

              {/* Work Order Items */}
              {workOrder.items && workOrder.items.length > 0 && (
                <div className="mt-3 space-y-2">
                  {workOrder.items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm p-2 rounded bg-charcoal-black/30"
                    >
                      <span className="text-bone-white">{item.asset_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-gray">Qty: {item.quantity}</span>
                        {item.is_staged ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-gray/30" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Organization Contact Card */}
        {organization && (
          <Card className="p-4 bg-charcoal-black/50 border-muted-gray/20">
            <h4 className="text-sm font-semibold text-bone-white mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Rental House
            </h4>

            <div className="flex items-start gap-3 mb-3">
              {organization.logo_url && (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="w-12 h-12 rounded object-cover"
                />
              )}
              <div className="flex-1">
                <p className="font-semibold text-bone-white">{organization.name}</p>
                {marketplaceSettings?.is_verified && (
                  <Badge variant="outline" className="text-xs mt-1">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>

            {/* Contact Info */}
            {marketplaceSettings && (
              <div className="space-y-2 text-sm">
                {marketplaceSettings.contact_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-gray flex-shrink-0" />
                    <a
                      href={`mailto:${marketplaceSettings.contact_email}`}
                      className="text-blue-400 hover:underline break-all"
                    >
                      {marketplaceSettings.contact_email}
                    </a>
                  </div>
                )}

                {marketplaceSettings.contact_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-gray flex-shrink-0" />
                    <a
                      href={`tel:${marketplaceSettings.contact_phone}`}
                      className="text-blue-400 hover:underline"
                    >
                      {marketplaceSettings.contact_phone}
                    </a>
                  </div>
                )}

                {marketplaceSettings.marketplace_location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-gray flex-shrink-0" />
                    <span className="text-muted-gray">{marketplaceSettings.marketplace_location}</span>
                  </div>
                )}

                {marketplaceSettings.marketplace_website && (
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-muted-gray flex-shrink-0" />
                    <a
                      href={marketplaceSettings.marketplace_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline break-all"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Message Button */}
            <Button
              onClick={() => setShowMessageDialog(true)}
              className="w-full mt-3"
              variant="outline"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Message Gear House
            </Button>
          </Card>
        )}

        {/* Action Buttons */}
        {rentalOrder && (
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full">
              <FileText className="w-4 h-4 mr-2" />
              View Full Order
            </Button>

            <Button variant="outline" className="w-full" onClick={() => setShowExtensionDialog(true)}>
              <Calendar className="w-4 h-4 mr-2" />
              Request Extension
            </Button>

            <Button
              variant="outline"
              className="w-full text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
              onClick={() => setShowIssueDialog(true)}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Report Issue/Damage
            </Button>
          </div>
        )}

        {/* Notes */}
        {gear.notes && (
          <Card className="p-4 bg-charcoal-black/50 border-muted-gray/20">
            <h4 className="text-sm font-semibold text-bone-white mb-2">Notes</h4>
            <p className="text-sm text-muted-gray whitespace-pre-wrap">{gear.notes}</p>
          </Card>
        )}

        {gear.condition_notes && (
          <Card className="p-4 bg-charcoal-black/50 border-muted-gray/20">
            <h4 className="text-sm font-semibold text-bone-white mb-2">Condition Notes</h4>
            <p className="text-sm text-muted-gray whitespace-pre-wrap">{gear.condition_notes}</p>
          </Card>
        )}
      </div>

      {/* Message Gear House Dialog */}
      {showMessageDialog && organization && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-charcoal-black border-muted-gray/20">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-bone-white mb-4">
                Message {organization.name}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-gray block mb-2">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g., Question about rental order"
                    className="w-full px-3 py-2 bg-charcoal-black/50 border border-muted-gray/20 rounded text-bone-white placeholder:text-muted-gray/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-gray block mb-2">Message</label>
                  <textarea
                    rows={4}
                    placeholder="Type your message here..."
                    className="w-full px-3 py-2 bg-charcoal-black/50 border border-muted-gray/20 rounded text-bone-white placeholder:text-muted-gray/50 resize-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowMessageDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      // TODO: Implement actual message sending
                      alert('Message functionality coming soon!');
                      setShowMessageDialog(false);
                    }}
                  >
                    Send Message
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Extension Request Dialog */}
      {showExtensionDialog && rentalOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-charcoal-black border-muted-gray/20">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-bone-white mb-4">
                Request Extension
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-gray block mb-2">Current Return Date</label>
                  <p className="text-bone-white">{formatDate(rentalOrder.rental_end_date)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-gray block mb-2">New Return Date</label>
                  <input
                    type="date"
                    min={rentalOrder.rental_end_date}
                    className="w-full px-3 py-2 bg-charcoal-black/50 border border-muted-gray/20 rounded text-bone-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-gray block mb-2">Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Why do you need to extend the rental?"
                    className="w-full px-3 py-2 bg-charcoal-black/50 border border-muted-gray/20 rounded text-bone-white placeholder:text-muted-gray/50 resize-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowExtensionDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      // TODO: Implement actual extension request
                      alert('Extension request functionality coming soon!');
                      setShowExtensionDialog(false);
                    }}
                  >
                    Submit Request
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Report Issue Dialog */}
      {showIssueDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-charcoal-black border-muted-gray/20">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-bone-white mb-4">
                Report Issue/Damage
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-gray block mb-2">Issue Type</label>
                  <select className="w-full px-3 py-2 bg-charcoal-black/50 border border-muted-gray/20 rounded text-bone-white">
                    <option>Damage</option>
                    <option>Malfunction</option>
                    <option>Missing Parts</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-gray block mb-2">Severity</label>
                  <select className="w-full px-3 py-2 bg-charcoal-black/50 border border-muted-gray/20 rounded text-bone-white">
                    <option>Minor</option>
                    <option>Moderate</option>
                    <option>Severe</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-gray block mb-2">Description</label>
                  <textarea
                    rows={4}
                    placeholder="Describe the issue in detail..."
                    className="w-full px-3 py-2 bg-charcoal-black/50 border border-muted-gray/20 rounded text-bone-white placeholder:text-muted-gray/50 resize-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowIssueDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      // TODO: Implement actual issue reporting
                      alert('Issue reporting functionality coming soon!');
                      setShowIssueDialog(false);
                    }}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    Submit Report
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
