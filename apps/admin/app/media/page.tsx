'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import ProtectedLayout from '@/components/protected-layout';
import { mediaApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Upload, 
  X, 
  Trash2, 
  Edit, 
  Search
} from 'lucide-react';

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
}

interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export default function MediaPage() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      const response = await mediaApi.list();
      setMediaItems(response.data || []);
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newUploads = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploads(prev => [...prev, ...newUploads]);

    for (const upload of newUploads) {
      try {
        const response = await mediaApi.upload(upload.file, {});
        
        setUploads(prev => 
          prev.map(u => 
            u.file === upload.file 
              ? { ...u, progress: 100, status: 'success' }
              : u
          )
        );

        // Add to media items
        setMediaItems(prev => [response.data, ...prev]);
      } catch (error: any) {
        setUploads(prev => 
          prev.map(u => 
            u.file === upload.file 
              ? { 
                  ...u, 
                  status: 'error', 
                  error: error.response?.data?.error?.message || 'Upload failed' 
                }
              : u
          )
        );
      }
    }

    // Clear completed uploads after 3 seconds
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.status === 'uploading'));
    }, 3000);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif']
    },
    multiple: true
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    try {
      await mediaApi.delete(id);
      setMediaItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to delete media:', error);
    }
  };

  const handleEdit = async (item: MediaItem, data: { project_name?: string; description?: string }) => {
    try {
      await mediaApi.update(item.id, data);
      setMediaItems(prev => 
        prev.map(i => 
          i.id === item.id 
            ? { ...i, ...data }
            : i
        )
      );
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update media:', error);
    }
  };

  const filteredItems = mediaItems.filter(item => {
    const matchesSearch = !searchTerm || 
      item.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProject = !filterProject || item.project_name === filterProject;
    
    return matchesSearch && matchesProject;
  });

  const uniqueProjects = Array.from(new Set(
    mediaItems.map(item => item.project_name).filter(Boolean)
  ));

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Media Gallery</h1>
            <p className="mt-2 text-gray-600">Manage your portfolio images</p>
          </div>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Images
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                {isDragActive
                  ? 'Drop the images here...'
                  : 'Drag & drop images here, or click to select files'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports: JPEG, PNG, WebP, GIF
              </p>
            </div>

            {/* Upload Progress */}
            {uploads.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploads.map((upload, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm truncate">{upload.file.name}</span>
                    <div className="flex items-center gap-2">
                      {upload.status === 'uploading' && (
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      )}
                      {upload.status === 'success' && (
                        <span className="text-green-600 text-sm">✓ Uploaded</span>
                      )}
                      {upload.status === 'error' && (
                        <span className="text-red-600 text-sm">✗ {upload.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search images..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-48">
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Projects</option>
              {uniqueProjects.map(project => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Media Grid */}
        {loading ? (
          <div className="text-center py-12">Loading media...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchTerm || filterProject ? 'No images match your filters' : 'No images uploaded yet'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="aspect-square relative">
                  <Image
                    src={`${item.url}?width=300&height=300`}
                    alt={item.filename}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingItem(item)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(item.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3">
                  <h3 className="font-medium text-sm truncate">{item.filename}</h3>
                  {item.project_name && (
                    <p className="text-xs text-blue-600 mt-1">{item.project_name}</p>
                  )}
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <span>{formatFileSize(item.file_size)}</span>
                    {item.width && item.height && (
                      <span>{item.width}×{item.height}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Edit Image</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingItem(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleEdit(editingItem, {
                    project_name: formData.get('project_name') as string || undefined,
                    description: formData.get('description') as string || undefined,
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="project_name">Project Name</Label>
                  <Input
                    id="project_name"
                    name="project_name"
                    defaultValue={editingItem.project_name || ''}
                    placeholder="e.g. VERSAND.GURU"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    defaultValue={editingItem.description || ''}
                    placeholder="Image description..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">Save Changes</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingItem(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}