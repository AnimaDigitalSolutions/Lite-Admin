'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import ProtectedLayout from '@/components/protected-layout';
import { mediaApi } from '@/lib/api';
import { useDisplayPrefs } from '@/lib/display-prefs';
import { highlightMatch } from '@/lib/utils';
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowUpTrayIcon,
  XMarkIcon,
  TrashIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useSelection } from '@/lib/hooks/use-selection';
import MediaEditModal from './components/media-edit-modal';
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
  thumbnailUrl?: string;
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
    default: return { label: 'FILE', color: 'bg-accent text-foreground' };
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

function formatDateFull(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// --- Component ---

export default function MediaPage() {
  const { prefs } = useDisplayPrefs();
  const { copy: clipboardCopy, isCopied } = useCopyToClipboard();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const { selectedIds, setSelectedIds, selectAll, clearSelection, toggleOne: toggleSelectOne } = useSelection<string>();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('media-view-mode') as ViewMode) || 'grid';
    }
    return 'grid';
  });
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterType, setFilterType] = useState<MediaType | 'all'>('all');

  useEffect(() => {
    void loadMedia();
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
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: { message?: string } } } };
        setUploads(prev =>
          prev.map(u =>
            u.file === upload.file
              ? {
                  ...u,
                  status: 'error',
                  error: err.response?.data?.error?.message || 'Upload failed'
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

  const maxSizeBytes = (prefs.maxUploadSizeMB || 10) * 1024 * 1024;

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'],
      'video/*': ['.mp4', '.webm', '.mov'],
      'application/pdf': ['.pdf'],
    },
    maxSize: maxSizeBytes,
    multiple: true
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await mediaApi.delete(id);
      setMediaItems(prev => prev.filter(item => item.id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (error) {
      console.error('Failed to delete media:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected item(s)?`)) return;
    try {
      for (const id of selectedIds) {
        await mediaApi.delete(id);
      }
      setMediaItems(prev => prev.filter(item => !selectedIds.has(item.id)));
      clearSelection();
    } catch (error) {
      console.error('Failed to bulk delete:', error);
    }
  };

  const handleBulkDownload = () => {
    const items = filteredAndSortedItems.filter(item => selectedIds.has(item.id));
    for (const item of items) {
      handleDownload(item);
    }
  };

  const handleBulkCopyPaths = async () => {
    const items = filteredAndSortedItems.filter(item => selectedIds.has(item.id));
    const base = (prefs.mediaBasePath || '/uploads/portfolio').replace(/\/+$/, '');
    const paths = items.map(item => {
      const filename = item.storage_path ? item.storage_path.split('/').pop() : item.filename;
      return `${base}/${filename}`;
    });
    await clipboardCopy(paths.join('\n'), '__bulk_paths__');
  };

  const handleDownload = (item: MediaItem) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.download = item.filename;
    link.click();
  };

  const handleEdit = async (item: MediaItem, data: { filename?: string; project_name?: string; description?: string }) => {
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

  const copyMediaPath = async (item: MediaItem) => {
    const base = (prefs.mediaBasePath || '/uploads/portfolio').replace(/\/+$/, '');
    const filename = item.storage_path ? item.storage_path.split('/').pop() : item.filename;
    await clipboardCopy(`${base}/${filename}`, item.id);
  };

  // --- Selection ---

  const handleSelectAll = (checked: boolean) => {
    checked ? selectAll(filteredAndSortedItems.map(i => i.id)) : clearSelection();
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n; });
  };

  // --- Preview navigation ---

  const navigatePreview = (direction: number) => {
    if (!previewItem) return;
    const idx = filteredAndSortedItems.findIndex(i => i.id === previewItem.id);
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < filteredAndSortedItems.length) {
      setPreviewItem(filteredAndSortedItems[nextIdx]);
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
    if (sortBy === map.asc) return <ChevronUpIcon className="h-3 w-3" />;
    if (sortBy === map.desc) return <ChevronDownIcon className="h-3 w-3" />;
    return <ArrowsUpDownIcon className="h-3 w-3 text-muted-foreground/50" />;
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

  const allSelected = filteredAndSortedItems.length > 0 && selectedIds.size === filteredAndSortedItems.length;

  // Keyboard nav for preview modal (must be after filteredAndSortedItems declaration)
  useEffect(() => {
    if (!previewItem) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewItem(null);
      if (e.key === 'ArrowLeft') navigatePreview(-1);
      if (e.key === 'ArrowRight') navigatePreview(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewItem, filteredAndSortedItems]);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Media Library</h1>
            <p className="mt-1 text-muted-foreground">
              {filteredAndSortedItems.length} {filteredAndSortedItems.length === 1 ? 'item' : 'items'}
              {(searchTerm || filterProject || filterType !== 'all') && ` (filtered from ${mediaItems.length})`}
            </p>
          </div>
          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => void handleBulkCopyPaths()}>
                <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                Copy Paths
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkDownload}>
                <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void handleBulkDelete()}>
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete ({selectedIds.size})
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <XMarkIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpTrayIcon className="h-5 w-5" />
              Upload Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-border hover:border-border'
              }`}
            >
              <input {...getInputProps()} />
              <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {isDragActive
                  ? 'Drop the files here...'
                  : 'Drag & drop files here, or click to select'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Images: JPEG, PNG, WebP, GIF · Videos: MP4, WebM, MOV · Documents: PDF · Max {prefs.maxUploadSizeMB || 10} MB
              </p>
            </div>

            {/* Rejection Messages */}
            {fileRejections.length > 0 && (
              <div className="mt-3 space-y-1">
                {fileRejections.map(({ file, errors }, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    <span className="font-medium truncate">{file.name}</span>
                    <span>—</span>
                    <span>{errors.map(e =>
                      e.code === 'file-too-large'
                        ? `Too large (max ${prefs.maxUploadSizeMB || 10} MB)`
                        : e.code === 'file-invalid-type'
                        ? 'File type not allowed'
                        : e.message
                    ).join(', ')}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Progress */}
            {uploads.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploads.map((upload, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm truncate">{upload.file.name}</span>
                    <div className="flex items-center gap-2">
                      {upload.status === 'uploading' && (
                        <div className="w-16 bg-muted rounded-full h-2">
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
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
            className="px-3 py-2 border border-border rounded-md text-sm"
          >
            {TYPE_FILTERS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-2 border border-border rounded-md text-sm"
          >
            <option value="">All Projects</option>
            {uniqueProjects.map(project => (
              <option key={project} value={project!}>{project}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border border-border rounded-md text-sm"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="flex border border-border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none border-0"
            >
              <Squares2X2Icon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none border-0"
            >
              <ListBulletIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">Loading media...</div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
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
              const isSelected = selectedIds.has(item.id);
              return (
                <Card key={item.id} className={`overflow-hidden group relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
                  <div className="relative h-48 cursor-pointer" onClick={() => setPreviewItem(item)}>
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnailUrl} alt={item.filename} className="w-full h-full object-cover" />
                    ) : mediaType === 'image' ? (
                      <Image
                        src={item.url}
                        alt={item.filename}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-accent flex items-center justify-center">
                        <DocumentTextIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                        className="h-8 w-8 p-0"
                        title="Preview"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                        className="h-8 w-8 p-0"
                        title="Download"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                        className="h-8 w-8 p-0"
                        title="Edit"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => { e.stopPropagation(); void handleDelete(item.id); }}
                        className="h-8 w-8 p-0"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Type badge */}
                    <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${badge.color}`}>
                      {badge.label}
                    </span>
                    {/* Selection checkbox */}
                    <div className={`absolute top-2 right-2 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-border text-blue-600 cursor-pointer"
                      />
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 group/name">
                      <h3 className="font-medium text-sm truncate" title={item.filename}>{highlightMatch(item.filename, searchTerm)}</h3>
                      <button
                        type="button"
                        onClick={() => void copyMediaPath(item)}
                        title="Copy media path"
                        className={`shrink-0 transition-colors ${isCopied(item.id) ? 'text-emerald-500' : 'text-muted-foreground opacity-0 group-hover/name:opacity-100 hover:text-foreground'}`}
                      >
                        {isCopied(item.id) ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {item.project_name && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{item.project_name}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatFileSize(item.file_size)}</span>
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
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-muted">
                      <th className="p-3 w-8">
                        <div className={`${selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}>
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={e => handleSelectAll(e.target.checked)}
                            className="rounded cursor-pointer"
                          />
                        </div>
                      </th>
                      <th className="text-left p-3 font-medium w-16"></th>
                      <th
                        className="text-left p-3 font-medium cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleColumnSort('name')}
                      >
                        <span className="flex items-center gap-1">
                          Filename
                          <SortIndicator column="name" />
                        </span>
                      </th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th
                        className="text-right p-3 font-medium cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleColumnSort('size')}
                      >
                        <span className="flex items-center justify-end gap-1">
                          Size
                          <SortIndicator column="size" />
                        </span>
                      </th>
                      <th className="text-left p-3 font-medium">Dimensions</th>
                      <th className="text-left p-3 font-medium">Project</th>
                      <th
                        className="text-left p-3 font-medium cursor-pointer select-none hover:text-foreground"
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
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <tr key={item.id} className={`border-b hover:bg-accent even:bg-muted/50 group/row ${isSelected ? 'bg-blue-50' : ''}`}>
                          <td className="p-3">
                            <div className={`${isSelected ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'} transition-opacity`}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => handleSelectOne(item.id, e.target.checked)}
                                className="rounded cursor-pointer"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div
                              className="w-12 h-12 relative rounded overflow-hidden bg-accent flex-shrink-0 cursor-pointer"
                              onClick={() => setPreviewItem(item)}
                            >
                              {item.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.thumbnailUrl} alt={item.filename} className="w-full h-full object-cover" />
                              ) : mediaType === 'image' ? (
                                <Image
                                  src={item.url}
                                  alt={item.filename}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                  sizes="48px"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DocumentTextIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="group/name flex items-center gap-1">
                              <div
                                className="font-medium text-sm truncate max-w-[200px] cursor-pointer hover:text-blue-600"
                                title={item.filename}
                                onClick={() => setPreviewItem(item)}
                              >
                                {highlightMatch(item.filename, searchTerm)}
                              </div>
                              <button
                                type="button"
                                onClick={() => void copyMediaPath(item)}
                                title="Copy media path"
                                className={`shrink-0 transition-colors ${isCopied(item.id) ? 'text-emerald-500' : 'text-muted-foreground opacity-0 group-hover/name:opacity-100 hover:text-foreground'}`}
                              >
                                {isCopied(item.id) ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            <div className="text-xs text-muted-foreground">{getFormatLabel(item.mime_type)}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground text-right tabular-nums">{formatFileSize(item.file_size)}</td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {item.width && item.height ? `${item.width} × ${item.height}` : '—'}
                          </td>
                          <td className="p-3">
                            {item.project_name ? (
                              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                {highlightMatch(item.project_name, searchTerm)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground" title={formatDateFull(item.uploaded_at)}>{formatDate(item.uploaded_at)}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPreviewItem(item)}
                                className="h-8 w-8 p-0"
                                title="Preview"
                              >
                                <EyeIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownload(item)}
                                className="h-8 w-8 p-0"
                                title="Download"
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingItem(item)}
                                className="h-8 w-8 p-0"
                                title="Edit"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleDelete(item.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete"
                              >
                                <TrashIcon className="h-4 w-4" />
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

        {/* Preview Modal */}
        {previewItem && (() => {
          const mediaType = getMediaType(previewItem.mime_type);
          const currentIdx = filteredAndSortedItems.findIndex(i => i.id === previewItem.id);
          const hasPrev = currentIdx > 0;
          const hasNext = currentIdx < filteredAndSortedItems.length - 1;
          return (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
              onClick={() => setPreviewItem(null)}
            >
              {/* Close button */}
              <button
                className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
                onClick={() => setPreviewItem(null)}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>

              {/* Info bar */}
              <div className="absolute top-4 left-4 text-white/80 text-sm z-10">
                <span className="font-medium">{previewItem.filename}</span>
                <span className="ml-3 text-white/50">{formatFileSize(previewItem.file_size)}</span>
                {previewItem.width && previewItem.height && (
                  <span className="ml-3 text-white/50">{previewItem.width} × {previewItem.height}</span>
                )}
                <span className="ml-3 text-white/50">{currentIdx + 1} / {filteredAndSortedItems.length}</span>
              </div>

              {/* Prev/Next */}
              {hasPrev && (
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 z-10"
                  onClick={(e) => { e.stopPropagation(); navigatePreview(-1); }}
                >
                  <ChevronLeftIcon className="h-8 w-8" />
                </button>
              )}
              {hasNext && (
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 z-10"
                  onClick={(e) => { e.stopPropagation(); navigatePreview(1); }}
                >
                  <ChevronRightIcon className="h-8 w-8" />
                </button>
              )}

              {/* Content */}
              <div className="max-w-[90vw] max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                {mediaType === 'image' ? (
                  <img
                    src={previewItem.url}
                    alt={previewItem.filename}
                    className="max-w-full max-h-[85vh] object-contain rounded"
                  />
                ) : mediaType === 'video' ? (
                  <video
                    src={previewItem.url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[85vh] rounded"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : previewItem.mime_type === 'application/pdf' ? (
                  <iframe
                    src={previewItem.url}
                    className="w-[80vw] h-[85vh] rounded bg-white"
                    title={previewItem.filename}
                  />
                ) : (
                  <div className="text-center text-white/70 p-12">
                    <DocumentTextIcon className="h-16 w-16 mx-auto mb-4" />
                    <p className="text-lg">{previewItem.filename}</p>
                    <p className="text-sm mt-2">Preview not available for this file type</p>
                    <Button
                      variant="secondary"
                      className="mt-4"
                      onClick={() => handleDownload(previewItem)}
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                )}
              </div>

              {/* Bottom actions */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleDownload(previewItem); }}>
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); void copyMediaPath(previewItem); }}>
                  <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                  Copy Path
                </Button>
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setPreviewItem(null); setEditingItem(previewItem); }}>
                  <PencilSquareIcon className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          );
        })()}

        {/* Edit Modal */}
        <MediaEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={async (id, data) => {
            const item = mediaItems.find(i => i.id === id);
            if (item) await handleEdit(item, data);
          }}
        />
      </div>
    </ProtectedLayout>
  );
}
