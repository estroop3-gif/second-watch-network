/**
 * PromoteToReviewModal - Modal for promoting a dailies clip to the Review system
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePromoteToReview } from "@/hooks/backlot/useDailies";
import { useReviewFolders } from "@/hooks/backlot/useReview";
import { BacklotDailiesClip } from "@/types/backlot";
import { Upload, Loader2, CheckCircle2, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PromoteToReviewModalProps {
  clip: BacklotDailiesClip | null;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: { assetId: string; assetName: string }) => void;
}

export function PromoteToReviewModal({
  clip,
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: PromoteToReviewModalProps) {
  const { toast } = useToast();
  const promoteToReview = usePromoteToReview();
  const { folders, isLoading: foldersLoading } = useReviewFolders({ projectId });

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [copyNotes, setCopyNotes] = useState(true);

  // Reset form when clip changes
  const resetForm = () => {
    if (clip) {
      // Build default name from clip metadata
      const parts: string[] = [];
      if (clip.scene_number) parts.push(`Scene ${clip.scene_number}`);
      if (clip.take_number) parts.push(`Take ${clip.take_number}`);
      if (parts.length === 0 && clip.file_name) {
        parts.push(clip.file_name.replace(/\.[^/.]+$/, "")); // Remove extension
      }
      setName(parts.join(" - ") || "Promoted Clip");
      setDescription(clip.notes || "");
    } else {
      setName("");
      setDescription("");
    }
    setFolderId("");
    setCopyNotes(true);
  };

  // Reset form when modal opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      resetForm();
    } else {
      onClose();
    }
  };

  const handlePromote = async () => {
    if (!clip) return;

    try {
      const result = await promoteToReview.mutateAsync({
        clipId: clip.id,
        folderId: folderId || null,
        name: name || null,
        description: description || null,
        copyNotes,
      });

      toast({
        title: "Promoted to Review",
        description: result.message,
      });

      onSuccess?.({
        assetId: result.asset_id,
        assetName: result.asset_name,
      });

      onClose();
    } catch (error) {
      toast({
        title: "Failed to promote",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  if (!clip) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-yellow-500" />
            Promote to Review
          </DialogTitle>
          <DialogDescription>
            Create a review asset from this dailies clip. The clip will be available
            for stakeholder review with annotation and approval features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Clip info summary */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="font-medium text-foreground">{clip.file_name}</div>
            <div className="text-muted-foreground">
              {clip.scene_number && `Scene ${clip.scene_number}`}
              {clip.take_number && ` / Take ${clip.take_number}`}
              {clip.duration_seconds && ` / ${Math.round(clip.duration_seconds)}s`}
            </div>
          </div>

          {/* Asset Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Review Asset Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name for the review asset"
            />
          </div>

          {/* Folder Selection */}
          <div className="space-y-2">
            <Label htmlFor="folder">Review Folder (Optional)</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger id="folder">
                <SelectValue placeholder="Select a folder..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Root (No folder)
                  </span>
                </SelectItem>
                {foldersLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading folders...
                  </SelectItem>
                ) : (
                  folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <span className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        {folder.name}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes for reviewers..."
              rows={3}
            />
          </div>

          {/* Copy Notes Option */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="copy-notes" className="text-sm font-medium">
                Copy Notes
              </Label>
              <p className="text-xs text-muted-foreground">
                Copy existing dailies notes to the review version
              </p>
            </div>
            <Switch
              id="copy-notes"
              checked={copyNotes}
              onCheckedChange={setCopyNotes}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handlePromote}
            disabled={promoteToReview.isPending || !name.trim()}
          >
            {promoteToReview.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Promoting...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Promote to Review
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PromoteToReviewModal;
