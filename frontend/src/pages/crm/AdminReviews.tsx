import { useState } from 'react';
import { useAdminReviews, useCreateReview, useDeleteReview } from '@/hooks/crm/useReviews';
import { useCRMReps } from '@/hooks/crm';
import ReviewCard from '@/components/crm/ReviewCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Star, Plus, Shield } from 'lucide-react';

const AdminReviews = () => {
  const { toast } = useToast();
  const [repFilter, setRepFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [repId, setRepId] = useState('');
  const [reviewType, setReviewType] = useState('admin_note');
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibleToRep, setVisibleToRep] = useState(true);

  const { data } = useAdminReviews({
    rep_id: repFilter !== 'all' ? repFilter : undefined,
    review_type: typeFilter !== 'all' ? typeFilter : undefined,
  });
  const { data: repsData } = useCRMReps();
  const createReview = useCreateReview();
  const deleteReview = useDeleteReview();

  const reviews = data?.reviews || [];
  const reps = repsData?.reps || [];

  const handleCreate = async () => {
    if (!repId) return;
    try {
      await createReview.mutateAsync({
        rep_id: repId,
        review_type: reviewType,
        rating,
        title: title || undefined,
        body: body || undefined,
        is_visible_to_rep: visibleToRep,
      });
      toast({ title: 'Review created' });
      setShowCreate(false);
      setRepId('');
      setTitle('');
      setBody('');
      setRating(5);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this review?')) return;
    try {
      await deleteReview.mutateAsync(id);
      toast({ title: 'Review deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow flex items-center gap-3">
            <Shield className="h-8 w-8" />
            Rep Reviews
          </h1>
          <p className="text-muted-gray mt-1">{data?.total || 0} total reviews</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={repFilter} onValueChange={setRepFilter}>
            <SelectTrigger className="w-40 bg-charcoal-black border-muted-gray text-bone-white">
              <SelectValue placeholder="All Reps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reps</SelectItem>
              {reps.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 bg-charcoal-black border-muted-gray text-bone-white">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="customer_review">Customer</SelectItem>
              <SelectItem value="admin_note">Admin Note</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Review
          </Button>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-12 text-muted-gray">No reviews found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((review: any) => (
            <div key={review.id}>
              <div className="text-xs text-muted-gray mb-1">Rep: {review.rep_name || 'Unknown'}</div>
              <ReviewCard review={review} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-md">
          <DialogHeader>
            <DialogTitle>Add Review / Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-gray block mb-2">Rep</label>
              <Select value={repId} onValueChange={setRepId}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray text-bone-white">
                  <SelectValue placeholder="Select rep" />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-gray block mb-2">Type</label>
              <Select value={reviewType} onValueChange={setReviewType}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray text-bone-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_note">Admin Note</SelectItem>
                  <SelectItem value="customer_review">Customer Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-gray block mb-2">Rating</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)}>
                    <Star className={`h-6 w-6 ${n <= rating ? 'text-accent-yellow fill-accent-yellow' : 'text-muted-gray'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-gray block mb-2">Title (optional)</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-charcoal-black border-muted-gray text-bone-white"
              />
            </div>
            <div>
              <label className="text-sm text-muted-gray block mb-2">Body (optional)</label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="bg-charcoal-black border-muted-gray text-bone-white"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={visibleToRep}
                onChange={(e) => setVisibleToRep(e.target.checked)}
                id="visible"
              />
              <label htmlFor="visible" className="text-sm text-muted-gray">Visible to rep</label>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!repId || createReview.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {createReview.isPending ? 'Creating...' : 'Add Review'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReviews;
