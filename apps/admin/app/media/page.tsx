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
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Play,
  FileText,
} from 'lucide-react';

// --- Types ---

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

type MediaType = 'image' | 'video' | 'document' | 'other';
type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'largest' | 'smallest';
type ViewMode = 'grid' | 'list';

// --- Constants ---

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'largest', label: 'Largest' },
  { value: 'smallest', label: 'Smallest' },
];

const TYPE_FILTERS: { value: MediaType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'document', label: 'Documents' },
];

const COLUMN_SORT_MAP: Record<string, { asc: SortOption; desc: SortOption }> = {
  name: { asc: 'name-asc', desc: 'name-desc' },
  size: { asc: 'smallest', desc: 'largest' },
  date: { asc: 'oldest', desc: 'newest' },
};

// --- Helpers ---

function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf' ||
      mimeType.startsWith('application/msword') ||
      mimeType.startsWith('application/vnd.openxmlformats') ||
      mimeType.startsWith('text/')) return 'document';
  return 'other';
}

function getTypeBadge(mimeType: string): { label: string; color: string } {
  const type = getMediaType(mimeType);
  switch (type) {
    case 'image': return { label: 'IMG', color: 'bg-blue-100 text-blue-800' };
    case 'video': return { label: 'VID', color: 'bg-purple-100 text-purple-800' };
    case 'document': return { label: 'DOC', color: 'bg-amber-100 text-amber-800' };
    default: return { label: 'FILE', color: 'bg-gray-100 text-gray-800' };
  }
}

function getFormatLabel(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP',
    'image/gif': 'GIF', 'video/mp4': 'MP4', 'video/webm': 'WebM',
    'video/quicktime': 'MOV', 'application/pdf': 'PDF',
  };
  return map[mimeType] || mimeType.split('/').pop()?.toUpperCase() || 'FILE';
}

function sortItems(items: MediaItem[], sort: SortOption): MediaItem[] {
  const sorted = [...items];
  switch (sort) {
    case 'newest': return sorted.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    case 'oldest': return sorted.sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime());
    case 'name-asc': return sorted.sort((a, b) => a.filename.localeCompare(b.filename));
    case 'name-desc': return sorted.sort((a, b) => b.filename.localeCompare(a.filename));
    case 'largest': return sorted.sort((a, b) => b.file_size - a.file_size);
    case 'smallest': return sorted.sort((a, b) => a.file_size - b.file_size);
    default: return sorted;
  }
}

function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// --- Component ---

export default function MediaPage() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('media-view-mode') as ViewMode) || 'grid';
    }
    return 'grid';
  });
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterType, setFilterType] = useState<MediaType | 'all'>('all');

  useEffect(() => {
    loadMedia();
  }, []);

  useEffect(() => {
    localStorage.setItem('media-view-mode', viewMode);
  }, [viewMode]);

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
    if (!confirm('Are you sure you want to delete this item?')) return;

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

  const handleColumnSort = (column: string) => {
    const map = COLUMN_SORT_MAP[column];
    if (!map) return;
    setSortBy(prev => prev === map.asc ? map.desc : map.asc);
  };

  const SortIndicator = ({ column }: { column: string }) => {
    const map = COLUMN_SORT_MAP[column];
    if (!map) return null;
    if (sortBy === map.asc) return <ChevronUp className="h-3 w-3" />;
    if (sortBy === map.desc) return <ChevronDown className="h-3 w-3" />;
    return <ArrowUpDown className="h-3 w-3 text-gray-300" />;
  };

  // --- Filter + Sort Pipeline ---

  const filteredAndSortedItems = sortItems(
    mediaItems.filter(item => {
      const matchesSearch = !searchTerm ||
        item.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.original_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProject = !filterProject || item.project_name === filterProject;
      const matchesType = filterType === 'all' || getMediaType(item.mime_type) === filterType;

      return matchesSearch && matchesProject && matchesType;
    }),
    sortBy
  );

  const uniqueProjects = Array.from(new Set(
    mediaItems.map(item => item.project_name).filter(Boolean)
  ));

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          <p className="mt-1 text-gray-600">
            {filteredAndSortedItems.length} {filteredAndSortedItems.length === 1 ? 'item' : 'items'}
            {(searchTerm || filterProject || filterType !== 'all') && ` (filtered from ${mediaItems.length})`}
          </p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Files
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
                  ? 'Drop the files here...'
                  : 'Drag & drop files here, or click to select'}
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
                        <span className="text-green-600 text-sm">Uploaded</span>
                      )}
                      {upload.status === 'error' && (
                        <span className="text-red-600 text-sm">{upload.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search media..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as MediaType | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {TYPE_FILTERS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All Projects</option>
            {uniqueProjects.map(project => (
              <option key={project} value={project!}>{project}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="flex border border-gray-300 rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none border-0"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none border-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">Loading media...</div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchTerm || filterProject || filterType !== 'all'
              ? 'No items match your filters'
              : 'No media uploaded yet'}
          </div>
        ) : viewMode === 'grid' ? (
          /* --- Grid View --- */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAndSortedItems.map((item) => {
              const badge = getTypeBadge(item.mime_type);
              const mediaType = getMediaType(item.mime_type);
              return (
                <Card key={item.id} className="overflow-hidden group">
                  <div className="relative h-48">
                    {mediaType === 'image' ? (
                      <Image
                        src={`${item.url}?width=400&height=300`}
                        alt={item.filename}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                    ) : mediaType === 'video' ? (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <Play className="h-12 w-12 text-gray-400" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <FileText className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
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
                    {/* Type badge */}
                    <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm truncate" title={item.filename}>{item.filename}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {item.project_name && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{item.project_name}</span>
                      )}
                      <span className="text-xs text-gray-500">{formatFileSize(item.file_size)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* --- List View --- */
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium w-16"></th>
                      <th
                        className="text-left p-3 font-medium cursor-pointer select-none hover:text-gray-900"
                        onClick={() => handleColumnSort('name')}
                      >
                        <span className="flex items-center gap-1">
                          Filename
                          <SortIndicator column="name" />
                        </span>
                      </th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th
                        className="text-left p-3 font-medium cursor-pointer select-none hover:text-gray-900"
                        onClick={() => handleColumnSort('size')}
                      >
                        <span className="flex items-center gap-1">
                          Size
                          <SortIndicator column="size" />
                        </span>
                      </th>
                      <th className="text-left p-3 font-medium">Dimensions</th>
                      <th className="text-left p-3 font-medium">Project</th>
                      <th
                        className="text-left p-3 font-medium cursor-pointer select-none hover:text-gray-900"
                        onClick={() => handleColumnSort('date')}
                      >
                        <span className="flex items-center gap-1">
                          Uploaded
                          <SortIndicator column="date" />
                        </span>
                      </th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedItems.map((item) => {
                      const badge = getTypeBadge(item.mime_type);
                      const mediaType = getMediaType(item.mime_type);
                      return (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div className="w-12 h-12 relative rounded overflow-hidden bg-gray-100 flex-shrink-0">
                              {mediaType === 'image' ? (
                                <Image
                                  src={`${item.url}?width=96&height=96`}
                                  alt={item.filename}
                                  fill
                                  className="object-cover"
                                  sizes="48px"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {mediaType === 'video'
                                    ? <Play className="h-5 w-5 text-gray-400" />
                                    : <FileText className="h-5 w-5 text-gray-400" />}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-sm truncate max-w-[200px]" title={item.filename}>
                              {item.filename}
                            </div>
                            <div className="text-xs text-gray-500">{getFormatLabel(item.mime_type)}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-gray-600">{formatFileSize(item.file_size)}</td>
                          <td className="p-3 text-sm text-gray-600">
                            {item.width && item.height ? `${item.width} × ${item.height}` : '—'}
                          </td>
                          <td className="p-3">
                            {item.project_name ? (
                              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                {item.project_name}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-gray-600">{formatDate(item.uploaded_at)}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingItem(item)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(item.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Edit Media</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingItem(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
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
