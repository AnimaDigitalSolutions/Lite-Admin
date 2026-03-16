'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTimezone } from '@/lib/timezone';
import { waitlistApi, campaignsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrashIcon,
  PaperAirplaneIcon,
  PlusIcon,
  XMarkIcon,
  PencilSquareIcon,
  MegaphoneIcon,
  DocumentTextIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

interface Campaign {
  id: number;
  name: string;
  subject: string;
  preheader?: string;
  html_content: string;
  text_content?: string;
  status: 'draft' | 'sent';
  target_type: 'all' | 'tagged';
  target_tags?: string;
  recipient_count?: number;
  sent_count?: number;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

const EMPTY_CAMPAIGN_FORM = {
  name: '', subject: '', preheader: '', html_content: '', text_content: '',
  target_type: 'all' as 'all' | 'tagged', target_tags: [] as string[],
};

export default function CampaignsTab() {
  const { formatDate } = useTimezone();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/edit modal
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_CAMPAIGN_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Tags
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [targetCount, setTargetCount] = useState<number | null>(null);

  // Recipient preview
  const [recipientPreview, setRecipientPreview] = useState<{ id: number; email: string; name?: string; tags?: string }[]>([]);
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);
  const [recipientPreviewLoading, setRecipientPreviewLoading] = useState(false);

  // Send confirmation
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [sendRecipients, setSendRecipients] = useState<{ id: number; email: string; name?: string; tags?: string }[]>([]);
  const [showSendRecipients, setShowSendRecipients] = useState(false);

  // Load available tags
  const loadTags = useCallback(async () => {
    try {
      const res = await waitlistApi.getTags();
      setAvailableTags(res.data || []);
    } catch { /* silently fail */ }
  }, []);

  // Update recipient count when target changes
  const updateTargetCount = useCallback(async (targetType: 'all' | 'tagged', tags: string[]) => {
    try {
      const res = await waitlistApi.countByTarget(targetType, tags);
      setTargetCount(res.data?.count ?? null);
    } catch { setTargetCount(null); }
  }, []);

  const loadRecipientPreview = useCallback(async (targetType: 'all' | 'tagged', tags: string[]) => {
    setRecipientPreviewLoading(true);
    try {
      const res = await waitlistApi.previewRecipients(targetType, tags);
      setRecipientPreview(res.data || []);
    } catch { setRecipientPreview([]); }
    finally { setRecipientPreviewLoading(false); }
  }, []);

  const openSendDialog = async (campaign: Campaign) => {
    setSendingId(campaign.id);
    setSubscriberCount(null);
    setSendRecipients([]);
    setShowSendRecipients(false);
    try {
      const tags = campaign.target_tags ? JSON.parse(campaign.target_tags) as string[] : [];
      const targetType = campaign.target_type || 'all';
      const [countRes, previewRes] = await Promise.all([
        waitlistApi.countByTarget(targetType, tags),
        waitlistApi.previewRecipients(targetType, tags),
      ]);
      setSubscriberCount(countRes.data?.count ?? null);
      setSendRecipients(previewRes.data || []);
    } catch {
      // non-blocking
    }
  };

  const loadCampaigns = useCallback(async () => {
    try {
      const response = await campaignsApi.list();
      setCampaigns(response.data || []);
    } catch {
      setError('Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
    void loadTags();
  }, [loadCampaigns, loadTags]);

  const [campaignFilter, setCampaignFilter] = useState<'draft' | 'sent' | null>(null);

  const filteredCampaigns = campaignFilter
    ? campaigns.filter(c => c.status === campaignFilter)
    : campaigns;

  const totalCount = campaigns.length;
  const draftCount = campaigns.filter(c => c.status === 'draft').length;
  const sentCount = campaigns.filter(c => c.status === 'sent').length;

  const toggleCampaignFilter = (filter: 'draft' | 'sent' | null) => {
    setCampaignFilter(prev => prev === filter ? null : filter);
  };

  const openCreate = () => {
    setEditingId(null);
    setViewOnly(false);
    setFormData(EMPTY_CAMPAIGN_FORM);
    setFormError(null);
    setTargetCount(null);
    setNewTagInput('');
    setShowForm(true);
    void updateTargetCount('all', []);
    void loadTags();
  };

  const openEdit = (c: Campaign) => {
    const parsedTags = c.target_tags ? (JSON.parse(c.target_tags) as string[]) : [];
    setEditingId(c.id);
    setViewOnly(false);
    setFormData({
      name: c.name,
      subject: c.subject,
      preheader: c.preheader || '',
      html_content: c.html_content,
      text_content: c.text_content || '',
      target_type: c.target_type || 'all',
      target_tags: parsedTags,
    });
    setFormError(null);
    setNewTagInput('');
    setShowForm(true);
    void updateTargetCount(c.target_type || 'all', parsedTags);
    void loadTags();
  };

  const openView = (c: Campaign) => {
    const parsedTags = c.target_tags ? (JSON.parse(c.target_tags) as string[]) : [];
    setEditingId(c.id);
    setViewOnly(true);
    setFormData({
      name: c.name,
      subject: c.subject,
      preheader: c.preheader || '',
      html_content: c.html_content || '',
      text_content: c.text_content || '',
      target_type: c.target_type || 'all',
      target_tags: parsedTags,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.html_content) {
      setFormError('Name, subject, and HTML content are required.');
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      if (editingId) {
        await campaignsApi.update(editingId, formData);
      } else {
        await campaignsApi.create(formData);
      }
      setShowForm(false);
      void loadCampaigns();
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setFormError(e.response?.data?.error?.message ?? e.message ?? 'Failed to save campaign');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this draft campaign?')) return;
    try {
      await campaignsApi.remove(id);
      void loadCampaigns();
    } catch {
      setError('Failed to delete campaign.');
    }
  };

  const handleSend = async (id: number) => {
    setSendLoading(true);
    try {
      const result = await campaignsApi.send(id);
      setSendingId(null);
      void loadCampaigns();
      const stats = result.stats;
      if (stats) {
        alert(`Campaign sent to ${stats.sent}/${stats.total} subscribers${stats.errors ? ` (${stats.errors} failed)` : ''}.`);
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(e.response?.data?.error?.message ?? e.message ?? 'Failed to send campaign');
      setSendingId(null);
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">&#10005;</button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div />
        <Button onClick={openCreate} className="flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([
          { icon: MegaphoneIcon, color: 'text-blue-600', label: 'Total Campaigns', value: totalCount, filter: null as 'draft' | 'sent' | null },
          { icon: DocumentTextIcon, color: 'text-amber-600', label: 'Drafts', value: draftCount, filter: 'draft' as const },
          { icon: PaperAirplaneIcon, color: 'text-green-600', label: 'Sent', value: sentCount, filter: 'sent' as const },
        ]).map(({ icon: Icon, color, label, value, filter }) => {
          const isClear = filter === null;
          const isActive = !isClear && campaignFilter === filter;
          return (
            <Card
              key={label}
              className={`transition-all cursor-pointer hover:shadow-md ${
                isActive ? 'ring-2 ring-gray-900 bg-gray-50' : ''
              }`}
              onClick={() => isClear ? setCampaignFilter(null) : toggleCampaignFilter(filter)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Icon className={`h-8 w-8 ${color}`} />
                  <div>
                    <p className="text-sm text-gray-600">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaigns ({filteredCampaigns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading campaigns...</div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {campaigns.length === 0 ? 'No campaigns yet. Create your first one!' : 'No campaigns match this filter'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Subject</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Audience</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{campaign.name}</td>
                      <td className="p-3 text-sm text-gray-600 max-w-[200px] truncate">{campaign.subject}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          campaign.status === 'sent'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {campaign.status === 'sent' ? 'Sent' : 'Draft'}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {campaign.status === 'sent'
                          ? (campaign.sent_count ?? campaign.recipient_count ?? '-')
                          : (() => {
                              const type = campaign.target_type || 'all';
                              if (type === 'all') return <span className="text-gray-400">All</span>;
                              const tags = campaign.target_tags ? JSON.parse(campaign.target_tags) as string[] : [];
                              return tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {tags.map(t => (
                                    <span key={t} className="bg-blue-50 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px] font-medium">{t}</span>
                                  ))}
                                </div>
                              ) : <span className="text-gray-400">All</span>;
                            })()
                        }
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {campaign.status === 'sent' && campaign.sent_at
                          ? formatDate(campaign.sent_at)
                          : formatDate(campaign.created_at)}
                      </td>
                      <td className="p-3">
                        {campaign.status === 'draft' ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => openEdit(campaign)}>
                              <PencilSquareIcon className="h-4 w-4" />
                            </Button>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => void openSendDialog(campaign)}>
                              <PaperAirplaneIcon className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => void handleDelete(campaign.id)}>
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => openView(campaign)}>
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Campaign Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">{viewOnly ? 'View Campaign' : editingId ? 'Edit Campaign' : 'New Campaign'}</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name {!viewOnly && '*'}</label>
                  <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="March Newsletter" readOnly={viewOnly} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line {!viewOnly && '*'}</label>
                  <Input value={formData.subject} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))} placeholder="Exciting news from our team" readOnly={viewOnly} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preheader {!viewOnly && '(optional)'}</label>
                  <Input value={formData.preheader} onChange={e => setFormData(p => ({ ...p, preheader: e.target.value }))} placeholder="Preview text shown in email clients" readOnly={viewOnly} />
                </div>

                {/* Audience / Targeting */}
                {viewOnly ? (
                  <div className="rounded-lg border border-gray-200 p-4 space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Audience</label>
                    <p className="text-sm text-gray-600">
                      {formData.target_type === 'all'
                        ? 'All subscribers'
                        : formData.target_tags.length > 0
                          ? <span className="flex flex-wrap gap-1">{formData.target_tags.map(t => <span key={t} className="bg-blue-100 text-blue-800 rounded-full px-2.5 py-0.5 text-xs font-medium">{t}</span>)}</span>
                          : 'All subscribers'}
                    </p>
                  </div>
                ) : (
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Audience</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio" name="target_type" value="all"
                        checked={formData.target_type === 'all'}
                        onChange={() => {
                          setFormData(p => ({ ...p, target_type: 'all', target_tags: [] }));
                          void updateTargetCount('all', []);
                        }}
                        className="accent-gray-900"
                      />
                      <span className="text-sm">All subscribers</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio" name="target_type" value="tagged"
                        checked={formData.target_type === 'tagged'}
                        onChange={() => {
                          setFormData(p => ({ ...p, target_type: 'tagged' }));
                          void updateTargetCount('tagged', formData.target_tags);
                        }}
                        className="accent-gray-900"
                      />
                      <span className="text-sm">Subscribers with tags</span>
                    </label>
                  </div>
                  {formData.target_type === 'tagged' && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {formData.target_tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 rounded-full px-2.5 py-0.5 text-xs font-medium">
                            {tag}
                            <button
                              type="button"
                              onClick={() => {
                                const next = formData.target_tags.filter(t => t !== tag);
                                setFormData(p => ({ ...p, target_tags: next }));
                                void updateTargetCount('tagged', next);
                              }}
                              className="hover:text-blue-600"
                            >
                              <XMarkIcon className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        {availableTags.length > 0 && (
                          <select
                            value=""
                            onChange={e => {
                              const tag = e.target.value;
                              if (tag && !formData.target_tags.includes(tag)) {
                                const next = [...formData.target_tags, tag];
                                setFormData(p => ({ ...p, target_tags: next }));
                                void updateTargetCount('tagged', next);
                              }
                            }}
                            className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                          >
                            <option value="">Select a tag...</option>
                            {availableTags.filter(t => !formData.target_tags.includes(t)).map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex gap-1">
                          <Input
                            value={newTagInput}
                            onChange={e => setNewTagInput(e.target.value)}
                            placeholder="New tag..."
                            className="h-9 w-32"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const tag = newTagInput.trim();
                                if (tag && !formData.target_tags.includes(tag)) {
                                  const next = [...formData.target_tags, tag];
                                  setFormData(p => ({ ...p, target_tags: next }));
                                  void updateTargetCount('tagged', next);
                                  setNewTagInput('');
                                }
                              }
                            }}
                          />
                          <Button
                            type="button" variant="outline" size="sm"
                            className="h-9"
                            onClick={() => {
                              const tag = newTagInput.trim();
                              if (tag && !formData.target_tags.includes(tag)) {
                                const next = [...formData.target_tags, tag];
                                setFormData(p => ({ ...p, target_tags: next }));
                                void updateTargetCount('tagged', next);
                                setNewTagInput('');
                              }
                            }}
                            disabled={!newTagInput.trim()}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                      {formData.target_tags.length === 0 && (
                        <p className="text-xs text-amber-600">Select at least one tag to target specific subscribers.</p>
                      )}
                    </div>
                  )}
                  {targetCount !== null && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500">
                        Will send to <strong>{targetCount}</strong> subscriber{targetCount !== 1 ? 's' : ''}
                      </p>
                      {targetCount > 0 && (
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => {
                            if (!showRecipientPreview) {
                              void loadRecipientPreview(formData.target_type, formData.target_tags);
                            }
                            setShowRecipientPreview(!showRecipientPreview);
                          }}
                        >
                          {showRecipientPreview ? 'Hide list' : 'Preview list'}
                        </button>
                      )}
                    </div>
                  )}
                  {showRecipientPreview && (
                    <div className="border border-gray-200 rounded-md max-h-[160px] overflow-y-auto">
                      {recipientPreviewLoading ? (
                        <p className="text-xs text-gray-400 p-3">Loading...</p>
                      ) : recipientPreview.length === 0 ? (
                        <p className="text-xs text-gray-400 p-3">No matching subscribers</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-gray-50">
                            <tr className="border-b">
                              <th className="text-left px-3 py-1.5 font-medium text-gray-500">Email</th>
                              <th className="text-left px-3 py-1.5 font-medium text-gray-500">Name</th>
                              <th className="text-left px-3 py-1.5 font-medium text-gray-500">Tags</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recipientPreview.map(s => {
                              let tags: string[] = [];
                              try { tags = s.tags ? JSON.parse(s.tags) : []; } catch { /* skip */ }
                              return (
                                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                                  <td className="px-3 py-1.5 text-gray-700">{s.email}</td>
                                  <td className="px-3 py-1.5 text-gray-500">{s.name || '-'}</td>
                                  <td className="px-3 py-1.5">
                                    {tags.length > 0 ? (
                                      <div className="flex flex-wrap gap-0.5">
                                        {tags.map(t => (
                                          <span key={t} className="bg-blue-50 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px]">{t}</span>
                                        ))}
                                      </div>
                                    ) : <span className="text-gray-300">-</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HTML Content {!viewOnly && '*'}</label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono min-h-[200px] focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    value={formData.html_content}
                    onChange={e => setFormData(p => ({ ...p, html_content: e.target.value }))}
                    placeholder="<html><body>Your email content here...</body></html>"
                    readOnly={viewOnly}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Text Fallback {!viewOnly && '(optional)'}</label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    value={formData.text_content}
                    onChange={e => setFormData(p => ({ ...p, text_content: e.target.value }))}
                    placeholder="Plain text version of your email"
                    readOnly={viewOnly}
                  />
                </div>
                {!viewOnly && formError && (
                  <div className="p-3 rounded-md bg-red-50 text-red-800 border border-red-200 text-sm">{formError}</div>
                )}
                <div className="flex gap-2 pt-2">
                  {!viewOnly && (
                    <Button onClick={() => void handleSave()} disabled={formLoading} className="flex items-center gap-2">
                      {formLoading ? 'Saving...' : editingId ? 'Update Campaign' : 'Create Draft'}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setShowForm(false)}>{viewOnly ? 'Close' : 'Cancel'}</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Dialog */}
      {sendingId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-6 flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Send Campaign</h2>
              <p className="text-gray-600">
                Are you sure you want to send this campaign to{' '}
                <strong>
                  {subscriberCount !== null
                    ? `${subscriberCount} active subscriber${subscriberCount !== 1 ? 's' : ''}`
                    : 'all active subscribers'}
                </strong>
                ? This action cannot be undone.
              </p>

              {/* Recipient list */}
              {sendRecipients.length > 0 && (
                <div>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mb-2"
                    onClick={() => setShowSendRecipients(!showSendRecipients)}
                  >
                    {showSendRecipients ? 'Hide recipient list' : `View all ${sendRecipients.length} recipients`}
                  </button>
                  {showSendRecipients && (
                    <div className="border border-gray-200 rounded-md max-h-[200px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr className="border-b">
                            <th className="text-left px-3 py-1.5 font-medium text-gray-500">Email</th>
                            <th className="text-left px-3 py-1.5 font-medium text-gray-500">Name</th>
                            <th className="text-left px-3 py-1.5 font-medium text-gray-500">Tags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sendRecipients.map(s => {
                            let tags: string[] = [];
                            try { tags = s.tags ? JSON.parse(s.tags) : []; } catch { /* skip */ }
                            return (
                              <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="px-3 py-1.5 text-gray-700">{s.email}</td>
                                <td className="px-3 py-1.5 text-gray-500">{s.name || '-'}</td>
                                <td className="px-3 py-1.5">
                                  {tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-0.5">
                                      {tags.map(t => (
                                        <span key={t} className="bg-blue-50 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px]">{t}</span>
                                      ))}
                                    </div>
                                  ) : <span className="text-gray-300">-</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                  onClick={() => void handleSend(sendingId)}
                  disabled={sendLoading}
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {sendLoading ? 'Sending...' : 'Send Now'}
                </Button>
                <Button variant="outline" onClick={() => setSendingId(null)} disabled={sendLoading}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
