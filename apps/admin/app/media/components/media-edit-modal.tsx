'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface MediaItem {
  id: string;
  filename: string;
  original_name: string;
  project_name?: string;
  description?: string;
  file_size: number;
  width?: number;
  height?: number;
  mime_type: string;
  storage_path: string;
  uploaded_at: string;
  url: string;
  thumbnailUrl?: string;
}

interface MediaEditModalProps {
  item: MediaItem | null;
  onClose: () => void;
  onSave: (id: string, data: { project_name?: string; description?: string; filename?: string }) => Promise<void>;
}

export default function MediaEditModal({ item, onClose, onSave }: MediaEditModalProps) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Edit Media</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </div>

        <form
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            void onSave(item.id, {
              filename: formData.get('filename') as string || undefined,
              project_name: formData.get('project_name') as string || undefined,
              description: formData.get('description') as string || undefined,
            });
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="filename">Filename</Label>
            <Input
              id="filename"
              name="filename"
              defaultValue={item.filename}
              placeholder="image.webp"
            />
          </div>

          <div>
            <Label htmlFor="project_name">Project Name</Label>
            <Input
              id="project_name"
              name="project_name"
              defaultValue={item.project_name || ''}
              placeholder="e.g. ANIMADIGITALSOLUTIONS"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={item.description || ''}
              placeholder="Description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">Save Changes</Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
