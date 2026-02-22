import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCreateContentRequest } from '@/hooks/media';
import { useMediaPlatforms } from '@/hooks/media';
import ContentRequestForm from '@/components/media/ContentRequestForm';
import { useToast } from '@/hooks/use-toast';

const NewRequest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createRequest = useCreateContentRequest();
  const { data: platformsData, isLoading: platformsLoading } = useMediaPlatforms();

  const platforms = platformsData?.platforms || [];

  const handleSubmit = async (values: any) => {
    try {
      const result = await createRequest.mutateAsync(values);
      toast({
        title: 'Request submitted',
        description: 'Your content request has been created successfully.',
      });
      navigate(`/media/requests/${result.id}`);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create request. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (platformsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back link */}
      <Link
        to="/media/requests"
        className="inline-flex items-center gap-1 text-sm text-muted-gray hover:text-bone-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to requests
      </Link>

      <h1 className="text-3xl font-heading text-bone-white">New Content Request</h1>
      <p className="text-muted-gray text-sm">
        Submit a content request for the media team to review and produce.
      </p>

      <ContentRequestForm
        platforms={platforms}
        onSubmit={handleSubmit}
        isSubmitting={createRequest.isPending}
      />
    </div>
  );
};

export default NewRequest;
