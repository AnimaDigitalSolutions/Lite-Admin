'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { templatesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CodeBracketIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageHeader } from '@/components/page-header';

interface TemplateData {
  name: string;
  default_html: string;
  custom_html: string | null;
  variables: string[];
}

const SAMPLE_DATA: Record<string, Record<string, string>> = {
  contact: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    company: 'Acme Corp',
    project_type: 'Web Application',
    message: 'Hi, I\'d love to discuss a new project with your team. We need a modern web application for our internal tooling.',
    date: new Date().toISOString(),
  },
  waitlist: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    date: new Date().toISOString(),
  },
};

function renderPreview(html: string, variables: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

const TEMPLATE_LABELS: Record<string, string> = {
  contact: 'Contact Notification',
  waitlist: 'Waitlist Confirmation',
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Record<string, TemplateData>>({});
  const [activeTemplate, setActiveTemplate] = useState<string>('contact');
  const [editorContent, setEditorContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [debouncedPreview, setDebouncedPreview] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all templates once on mount
  const load = useCallback(async () => {
    try {
      const res = await templatesApi.list();
      setTemplates(res.data);
      const tpl = res.data['contact'];
      if (tpl) {
        const html = tpl.custom_html || tpl.default_html;
        setEditorContent(html);
        setDebouncedPreview(html);
      }
    } catch {
      setError('Failed to load email templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Debounce preview rendering (150ms)
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      setDebouncedPreview(editorContent);
    }, 150);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [editorContent]);

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirtyRef.current && !savingRef.current) {
          void handleSaveRef.current();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const currentTemplate = templates[activeTemplate];
  const isDirty = currentTemplate
    ? editorContent !== (currentTemplate.custom_html || currentTemplate.default_html)
    : false;
  const isCustomized = currentTemplate?.custom_html ? true : false;

  // Refs for event handlers (avoids stale closures)
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const savingRef = useRef(saving);
  savingRef.current = saving;

  const handleSave = useCallback(async () => {
    if (!editorContent.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await templatesApi.update(activeTemplate, editorContent);
      setTemplates(prev => ({
        ...prev,
        [activeTemplate]: {
          ...prev[activeTemplate],
          custom_html: editorContent,
        },
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save template.');
    } finally {
      setSaving(false);
    }
  }, [activeTemplate, editorContent]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const switchTemplate = (name: string) => {
    if (name === activeTemplate) return;
    if (isDirty) {
      const discard = window.confirm(
        `You have unsaved changes to "${TEMPLATE_LABELS[activeTemplate] || activeTemplate}". Discard them?`
      );
      if (!discard) return;
    }
    setActiveTemplate(name);
    const tpl = templates[name];
    if (tpl) {
      const html = tpl.custom_html || tpl.default_html;
      setEditorContent(html);
      setDebouncedPreview(html);
    }
    setSaved(false);
    setConfirmingReset(false);
    setError(null);
  };

  const handleReset = async () => {
    setResetting(true);
    setError(null);
    try {
      await templatesApi.reset(activeTemplate);
      const defaultHtml = currentTemplate?.default_html || '';
      setEditorContent(defaultHtml);
      setDebouncedPreview(defaultHtml);
      setTemplates(prev => ({
        ...prev,
        [activeTemplate]: {
          ...prev[activeTemplate],
          custom_html: null,
        },
      }));
    } catch {
      setError('Failed to reset template.');
    } finally {
      setResetting(false);
      setConfirmingReset(false);
    }
  };

  if (loading) return (
    <ProtectedLayout>
      <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
    </ProtectedLayout>
  );

  const templateNames = Object.keys(templates);

  return (
    <ProtectedLayout>
      <div className="space-y-4">
        <PageHeader title="Email Templates" description="Customize the HTML templates used for outgoing emails. Changes take effect immediately." />

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {/* Template tabs + variable chips — single compact row */}
        <div className="flex items-center justify-between gap-4 border-b border-border pb-0">
          <div className="flex gap-1">
            {templateNames.map(name => {
              const active = activeTemplate === name;
              const tpl = templates[name];
              return (
                <button
                  key={name}
                  onClick={() => switchTemplate(name)}
                  className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'text-foreground border-b-2 border-foreground -mb-px'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {TEMPLATE_LABELS[name] || name}
                  {tpl?.custom_html && (
                    <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" title="Customized" />
                  )}
                </button>
              );
            })}
          </div>
          {/* Inline variable chips */}
          {currentTemplate && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Variables:</span>
              {currentTemplate.variables.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    const ta = textareaRef.current;
                    if (ta) {
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const text = `{{${v}}}`;
                      const newContent = editorContent.slice(0, start) + text + editorContent.slice(end);
                      setEditorContent(newContent);
                      setTimeout(() => {
                        ta.focus();
                        ta.selectionStart = ta.selectionEnd = start + text.length;
                      }, 0);
                    }
                  }}
                  className="shrink-0 rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-accent hover:border-border transition-colors"
                  title={`Insert {{${v}}}`}
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {currentTemplate && (
          <>
            {/* Editor + Preview — fill viewport */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ minHeight: 'calc(100vh - 320px)' }}>
              {/* Editor */}
              <Card className="flex flex-col">
                <CardHeader className="py-2.5 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CodeBracketIcon className="h-4 w-4" />
                      HTML Source
                      {isDirty && <span className="text-xs text-amber-600 font-normal">(unsaved)</span>}
                      {isCustomized && !isDirty && <span className="text-xs text-blue-600 font-normal">(customized)</span>}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">Ctrl+S to save</span>
                      <button
                        type="button"
                        onClick={() => setShowPreview(p => !p)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground lg:hidden"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        {showPreview ? 'Hide' : 'Show'} Preview
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-3 pt-0">
                  <textarea
                    ref={textareaRef}
                    value={editorContent}
                    onChange={e => setEditorContent(e.target.value)}
                    className="h-full min-h-[400px] w-full resize-none rounded-md border border-border bg-muted p-3 font-mono text-xs leading-relaxed text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-ring"
                    spellCheck={false}
                  />
                </CardContent>
              </Card>

              {/* Preview */}
              <Card className={`flex flex-col ${showPreview ? '' : 'hidden lg:flex'}`}>
                <CardHeader className="py-2.5 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <EyeIcon className="h-4 w-4" />
                    Live Preview
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Rendered with sample data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-3 pt-0">
                  <div className="h-full min-h-[400px] overflow-hidden rounded-md border border-border bg-card">
                    <iframe
                      srcDoc={renderPreview(debouncedPreview, SAMPLE_DATA[activeTemplate] || {})}
                      className="h-full w-full border-0"
                      sandbox="allow-same-origin"
                      title="Email template preview"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button onClick={() => void handleSave()} disabled={saving || !isDirty}>
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
              {isCustomized && !confirmingReset && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmingReset(true)}
                  className="text-muted-foreground"
                >
                  <ArrowPathIcon className="mr-1.5 h-3.5 w-3.5" />
                  Reset to Default
                </Button>
              )}
              {confirmingReset && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-sm text-amber-800">Delete custom template and restore default?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void handleReset()}
                    disabled={resetting}
                    className="ml-1 h-7 px-2.5 text-xs"
                  >
                    {resetting ? 'Resetting...' : 'Yes, reset'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmingReset(false)}
                    className="h-7 px-2.5 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  Template saved
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}
