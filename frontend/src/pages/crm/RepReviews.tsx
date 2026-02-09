import { useMyReviews } from '@/hooks/crm/useReviews';
import ReviewCard from '@/components/crm/ReviewCard';
import { Star } from 'lucide-react';

const RepReviews = () => {
  const { data, isLoading } = useMyReviews();
  const reviews = data?.reviews || [];

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow flex items-center gap-3">
            <Star className="h-8 w-8" />
            My Reviews
          </h1>
          <p className="text-muted-gray mt-1">
            {reviews.length} review{reviews.length !== 1 ? 's' : ''} — Average: {avgRating}/5
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-gray">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12">
          <Star className="h-12 w-12 text-muted-gray mx-auto mb-3" />
          <p className="text-muted-gray">No reviews yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((review: any) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RepReviews;
