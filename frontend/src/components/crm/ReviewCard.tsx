import { Star, User } from 'lucide-react';

interface ReviewCardProps {
  review: any;
  onDelete?: (id: string) => void;
}

const ReviewCard = ({ review, onDelete }: ReviewCardProps) => {
  const contactName = [review.contact_first_name, review.contact_last_name].filter(Boolean).join(' ');
  const stars = Array.from({ length: 5 }, (_, i) => i < review.rating);

  return (
    <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          {review.title && (
            <h4 className="text-sm font-medium text-bone-white">{review.title}</h4>
          )}
          <div className="flex items-center gap-1 mt-1">
            {stars.map((filled, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${filled ? 'text-accent-yellow fill-accent-yellow' : 'text-muted-gray'}`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded ${
            review.review_type === 'customer_review' ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'
          }`}>
            {review.review_type === 'customer_review' ? 'Customer' : 'Admin'}
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(review.id)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {review.body && (
        <p className="text-sm text-muted-gray mb-2">{review.body}</p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-gray">
        <div className="flex items-center gap-2">
          {contactName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {contactName}
            </span>
          )}
          {review.reviewer_name && (
            <span>by {review.reviewer_name}</span>
          )}
        </div>
        <span>{new Date(review.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default ReviewCard;
