/**
 * API Keys Section
 * Manage desktop API keys for the SWN Dailies Helper application
 */
import React, { useState } from 'react';
import { useDesktopKeys } from '@/hooks/useDesktopKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Key, Copy, Check, Trash2, Plus, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DesktopKeyCreateResponse } from '@/types';

export const ApiKeysSection = () => {
  const { keys, isLoading, createKey, isCreating, revokeKey, isRevoking } = useDesktopKeys();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<DesktopKeyCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setError(null);

    try {
      const result = await createKey(newKeyName.trim());
      setCreatedKey(result);
      setShowCreateDialog(false);
      setShowKeyDialog(true);
      setNewKeyName('');
    } catch (err: any) {
      setError(err.message || 'Failed to create key');
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = createdKey.key;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevokeKey = async () => {
    if (!keyToRevoke) return;
    try {
      await revokeKey(keyToRevoke);
      setShowRevokeDialog(false);
      setKeyToRevoke(null);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke key');
    }
  };

  const confirmRevoke = (keyId: string) => {
    setKeyToRevoke(keyId);
    setShowRevokeDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-dark-gray border-muted-gray">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Key className="h-5 w-5" />
            Desktop API Keys
          </CardTitle>
          <CardDescription>
            Manage API keys for the SWN Dailies Helper desktop application.
            Keys allow the app to upload footage and sync with your projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="text-center py-8 text-muted-gray">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys yet.</p>
              <p className="text-sm mt-2">Create a key to connect the SWN Dailies Helper.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 bg-black/30 rounded-lg border border-muted-gray/30"
                >
                  <div className="flex-1">
                    <div className="font-medium text-white">{key.name}</div>
                    <div className="text-sm text-muted-gray flex items-center gap-2 mt-1">
                      <code className="bg-black/50 px-2 py-0.5 rounded text-xs">
                        {key.key_prefix}...
                      </code>
                      <span>
                        Created {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
                      </span>
                      {key.last_used_at && (
                        <span>
                          Last used {formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => confirmRevoke(key.id)}
                    disabled={isRevoking}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={() => setShowCreateDialog(true)}
            className="mt-6 bg-accent-yellow text-black hover:bg-yellow-400"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Key
          </Button>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-dark-gray border-muted-gray">
          <DialogHeader>
            <DialogTitle className="text-white">Create Desktop API Key</DialogTitle>
            <DialogDescription>
              Give this key a name to identify where it's used (e.g., "Work Laptop", "Edit Bay 1").
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Key name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="bg-black/50 border-muted-gray"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
            />
            {error && (
              <div className="flex items-center gap-2 mt-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateDialog(false);
                setNewKeyName('');
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={!newKeyName.trim() || isCreating}
              className="bg-accent-yellow text-black hover:bg-yellow-400"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key Created Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="bg-dark-gray border-muted-gray">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Check className="h-5 w-5 text-green-400" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy this key now - you won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/50 p-3 rounded border border-muted-gray text-accent-yellow font-mono text-sm break-all">
                {createdKey?.key}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyKey}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowKeyDialog(false);
                setCreatedKey(null);
              }}
              className="bg-accent-yellow text-black hover:bg-yellow-400"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Key Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent className="bg-dark-gray border-muted-gray">
          <DialogHeader>
            <DialogTitle className="text-white">Revoke API Key?</DialogTitle>
            <DialogDescription>
              This will immediately disconnect any device using this key.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowRevokeDialog(false);
                setKeyToRevoke(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevokeKey}
              disabled={isRevoking}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {isRevoking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApiKeysSection;
