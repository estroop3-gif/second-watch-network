/**
 * Project Submission Page
 * Filmmakers submit their projects
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { greenroomAPI, Cycle, ProjectSubmitRequest } from '@/lib/api/greenroom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Film, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export default function GreenRoomSubmit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);

  const [formData, setFormData] = useState<ProjectSubmitRequest>({
    cycle_id: 0,
    title: '',
    description: '',
    category: '',
    video_url: '',
    image_url: '',
  });

  useEffect(() => {
    loadCycles();
  }, []);

  const loadCycles = async () => {
    try {
      setLoading(true);
      // Get active and upcoming cycles
      const [active, upcoming] = await Promise.all([
        greenroomAPI.listCycles('active'),
        greenroomAPI.listCycles('upcoming'),
      ]);
      setCycles([...active, ...upcoming]);
    } catch (error) {
      console.error('Failed to load cycles:', error);
      toast.error('Failed to load voting cycles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cycle_id) {
      toast.error('Please select a voting cycle');
      return;
    }

    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const project = await greenroomAPI.submitProject(formData);
      toast.success('Project submitted successfully! Awaiting admin approval.');
      navigate(`/greenroom/projects/${project.id}`);
    } catch (error: any) {
      console.error('Failed to submit project:', error);
      toast.error(error.message || 'Failed to submit project');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg text-muted-foreground mb-4">
              Please sign in to submit a project
            </p>
            <Link to="/login">
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-6">
        <Link to="/greenroom">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Green Room
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Film className="h-8 w-8" />
          <h1 className="text-4xl font-bold">Submit Your Project</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Share your project idea with the Second Watch community
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            All submissions require admin approval before appearing in the voting cycle.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cycle Selection */}
            <div className="space-y-2">
              <Label htmlFor="cycle">Voting Cycle *</Label>
              <Select
                value={formData.cycle_id.toString()}
                onValueChange={(v) => setFormData({ ...formData, cycle_id: parseInt(v) })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a voting cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id.toString()}>
                      {cycle.name} ({cycle.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                placeholder="Enter your project title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe your project idea, story, and vision..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={6}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground">
                Minimum 10 characters. Be detailed and compelling!
              </p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drama">Drama</SelectItem>
                  <SelectItem value="comedy">Comedy</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                  <SelectItem value="documentary">Documentary</SelectItem>
                  <SelectItem value="horror">Horror</SelectItem>
                  <SelectItem value="scifi">Sci-Fi</SelectItem>
                  <SelectItem value="faith">Faith-Based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Video URL */}
            <div className="space-y-2">
              <Label htmlFor="video_url">Pitch Video URL</Label>
              <Input
                id="video_url"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={formData.video_url}
                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                YouTube, Vimeo, or other video hosting URL (optional but recommended)
              </p>
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="image_url">Project Image URL</Label>
              <Input
                id="image_url"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Poster, concept art, or promotional image (optional)
              </p>
            </div>

            {/* Info Alert */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your project will be reviewed by admins before appearing in the voting cycle.
                You'll be notified once it's approved.
              </AlertDescription>
            </Alert>

            {/* Submit Button */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Project'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
