'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, 
  Eye, 
  Edit3, 
  ArrowLeft, 
  Globe, 
  Clock, 
  Share2, 
  Download,
  Tag,
  Calendar,
  FileText,
  Bold,
  Italic,
  Link,
  List,
  Quote,
  Image,
  Trash2,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';

// Interface for the data structure expected from the API
interface BlogApiResponse {
  id: number;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  productName?: string;
  targetAudience?: string;
  wordCount: number;
  keywords: string[];
  metaDescription: string;
  views?: number | null;
  engagement?: number | null;
  productId?: number | null;
  applicationId?: number | null;
  metadata?: any;
}

interface BlogEditorProps {
  blogId?: number;
  onBack: () => void;
  mode: 'edit' | 'view' | 'create';
}

export default function BlogEditor({ blogId: initialBlogId, onBack, mode: initialMode }: BlogEditorProps) {
  const [blogData, setBlogData] = useState<BlogApiResponse | null>(null);
  const [currentBlogId, setCurrentBlogId] = useState<number | undefined>(initialBlogId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentMode, setCurrentMode] = useState(initialMode);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [editableProductId, setEditableProductId] = useState<number | null | undefined>(undefined);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setMetaDescription('');
    setKeywords([]);
    setStatus('draft');
    setEditableProductId(null);
    setBlogData(null);
    setCurrentBlogId(undefined);
    setHasChanges(false);
  };

  const populateForm = useCallback((data: BlogApiResponse | null) => {
    if (data) {
      setBlogData(data);
      setTitle(data.title || '');
      setContent(data.content || '');
      setMetaDescription(data.metaDescription || '');
      setKeywords(Array.isArray(data.keywords) ? data.keywords : []);
      setStatus(data.status || 'draft');
      setEditableProductId(data.productId);
      setCurrentBlogId(data.id);
    } else {
      resetForm();
    }
    setHasChanges(false);
  }, []);

  const fetchBlog = useCallback(async (id: number) => {
    if (currentMode === 'create') {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/blogs/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch blog (status ${response.status})`);
      }
      const data: { success: boolean, blog: BlogApiResponse } = await response.json();
      if (data.success && data.blog) {
        populateForm(data.blog);
      } else {
        throw new Error(data.success ? 'Blog data not found in response' : (data as any).error || 'API request failed');
      }
    } catch (error) {
      console.error('Failed to fetch blog:', error);
      alert(`Error fetching blog: ${error instanceof Error ? error.message : String(error)}`);
      populateForm(null);
      onBack();
    } finally {
      setLoading(false);
    }
  }, [currentMode, onBack, populateForm]);

  useEffect(() => {
    setCurrentMode(initialMode);
    if (initialMode === 'create') {
      resetForm();
      setLoading(false);
    } else if (initialBlogId && initialBlogId !== currentBlogId) {
      setCurrentBlogId(initialBlogId);
      fetchBlog(initialBlogId);
    } else if (initialBlogId && !blogData && initialMode !== 'create') {
        fetchBlog(initialBlogId);
    } else if (!initialBlogId && initialMode !== 'create') {
        setLoading(false);
        populateForm(null);
    }
  }, [initialBlogId, initialMode, fetchBlog, currentBlogId, blogData]);

  const handleInputChange = (field: string, value: any) => {
    setHasChanges(true);
    switch (field) {
      case 'title': setTitle(value); break;
      case 'content': setContent(value); break;
      case 'metaDescription': setMetaDescription(value); break;
      case 'keywords': setKeywords(value); break;
      case 'status': setStatus(value); break;
      case 'editableProductId': setEditableProductId(value === '' ? null : Number(value)); break;
    }
  };

  const addKeyword = (keywordInput: string) => {
    const newKeyword = keywordInput.trim();
    if (newKeyword && !keywords.includes(newKeyword)) {
      handleInputChange('keywords', [...keywords, newKeyword]);
    }
  };

  const removeKeyword = (index: number) => {
    handleInputChange('keywords', keywords.filter((_, i) => i !== index));
  };

  const handleSave = async (publishOverride?: boolean) => {
    if (!title.trim()) {
      alert("Title is required.");
      return;
    }
    setSaving(true);
    const payload: Partial<BlogApiResponse> & { wordCount: number } = {
      title,
      content,
      metaDescription,
      keywords,
      status: publishOverride ? 'published' : status,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      productId: editableProductId === undefined ? null : editableProductId,
      metadata: {
        ...(blogData?.metadata || {}),
        targetAudience: blogData?.targetAudience || "Research Scientists"
      },
    };
    let response;
    let url = '/api/blogs';
    let method: 'POST' | 'PUT' = 'POST';
    if (currentMode === 'edit' && currentBlogId) {
      url = `/api/blogs/${currentBlogId}`;
      method = 'PUT';
    } else if (currentMode !== 'create') {
      console.error("Save called in invalid mode or without blogId for edit.");
      setSaving(false);
      alert("Error: Cannot save in the current mode.");
      return;
    }
    try {
      response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json();
      if (!response.ok || !responseData.success) {
        throw new Error(responseData.error || responseData.details?.message || responseData.message || `Failed to save blog (status ${response.status})`);
      }
      alert(`Blog ${publishOverride ? 'published' : 'saved'} successfully!`);
      if (responseData.blog) {
        populateForm(responseData.blog as BlogApiResponse);
        if (currentMode === 'create') {
          setCurrentMode('edit');
        }
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save blog:', error);
      alert(`Failed to save blog. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = () => {
    handleSave(true);
  };

  const handleDelete = async () => {
    if (!currentBlogId) {
        alert("No blog selected to delete or blog not yet saved.");
        return;
    }
    if (!confirm("Are you sure you want to delete this blog post? This action cannot be undone.")) {
        return;
    }
    setSaving(true);
    try {
        const response = await fetch(`/api/blogs/${currentBlogId}`, {
            method: 'DELETE',
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || data.message || `Failed to delete blog (status ${response.status})`);
        }
        alert("Blog deleted successfully!");
        onBack(); 
    } catch (error) {
        console.error('Failed to delete blog:', error);
        alert(`Failed to delete blog. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setSaving(false);
    }
  };

  const isEditingMode = currentMode === 'edit' || currentMode === 'create';

  if (loading && (String(initialMode) === 'edit' || String(initialMode) === 'view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading blog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog List
          </button>
          
          {blogData && (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                status === 'published' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : status === 'draft'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {status === 'published' ? <Globe className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {status}
              </span>
              {(typeof blogData.views === 'number') && (
                <span className="text-sm text-gray-500">
                  {blogData.views.toLocaleString()} views
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="flex items-center gap-1 text-amber-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              Unsaved changes
            </span>
          )}
          
          {!isEditingMode && (
            <button
              onClick={() => setCurrentMode('edit')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          )}
          
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Hide Preview' : 'Preview'}
          </button>

          {isEditingMode && (
            <>
              <button
                onClick={() => handleSave()}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Draft
              </button>
              
              {status !== 'published' && (
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  Publish
                </button>
              )}
            </>
          )}

          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Editor/Viewer */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {isEditingMode ? (
              <div className="p-6 space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xl font-semibold"
                    placeholder="Enter blog title..."
                  />
                </div>

                {/* Content Editor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content
                  </label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Toolbar */}
                    <div className="bg-gray-50 border-b border-gray-200 p-3 flex items-center gap-2">
                      <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded">
                        <Bold className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded">
                        <Italic className="w-4 h-4" />
                      </button>
                      <div className="w-px h-6 bg-gray-300"></div>
                      <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded">
                        <Link className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded">
                        <List className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded">
                        <Quote className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded">
                        <Image className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <textarea
                      value={content}
                      onChange={(e) => handleInputChange('content', e.target.value)}
                      className="w-full h-96 p-4 border-0 focus:ring-0 resize-none font-mono text-sm"
                      placeholder="Write your blog content in Markdown..."
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Supports Markdown formatting. Word count: {content.split(/\s+/).filter(w => w).length}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-6">{title}</h1>
                
                {blogData && (
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-8 pb-6 border-b border-gray-200">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(blogData.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                    <span>•</span>
                    <span>{blogData.wordCount} words</span>
                    <span>•</span>
                    <span>{Math.ceil(blogData.wordCount / 200)} min read</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Tag className="w-4 h-4" />
                      {blogData.productName}
                    </span>
                  </div>
                )}

                <div 
                  className="prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: content.split('\n').map(line => {
                      if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
                      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
                      if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
                      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
                      if (line.startsWith('**') && line.endsWith('**')) return `<strong>${line.slice(2, -2)}</strong>`;
                      return line ? `<p>${line}</p>` : '<br>';
                    }).join('')
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Meta Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Blog Details</h3>
            
            <div className="space-y-4">
              {/* Status */}
              {isEditingMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}

              {/* Meta Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Description
                </label>
                {isEditingMode ? (
                  <textarea
                    value={metaDescription}
                    onChange={(e) => handleInputChange('metaDescription', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={3}
                    placeholder="SEO description..."
                  />
                ) : (
                  <p className="text-sm text-gray-600">{metaDescription}</p>
                )}
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs"
                    >
                      {keyword}
                      {isEditingMode && (
                        <button
                          onClick={() => removeKeyword(index)}
                          className="text-indigo-500 hover:text-indigo-700"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {isEditingMode && (
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    placeholder="Add keyword and press Enter"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addKeyword(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                )}
              </div>

              {blogData && (
                <>
                  <div className="pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-gray-500">Created</p><p className="font-medium">{new Date(blogData.createdAt).toLocaleDateString()}</p></div>
                      <div><p className="text-gray-500">Updated</p><p className="font-medium">{new Date(blogData.updatedAt).toLocaleDateString()}</p></div>
                    </div>
                  </div>
                  {(typeof blogData.views === 'number' || typeof blogData.engagement === 'number') && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-gray-500">Views</p><p className="font-medium">{typeof blogData.views === 'number' ? blogData.views.toLocaleString() : '-'}</p></div>
                        <div><p className="text-gray-500">Engagement</p><p className="font-medium">{typeof blogData.engagement === 'number' ? blogData.engagement + '%' : '-'}</p></div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
            
            <div className="space-y-3">
              <button className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                <Copy className="w-4 h-4" />
                Duplicate Blog
              </button>
              
              <button className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                Export as PDF
              </button>
              
              <button className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                <ExternalLink className="w-4 h-4" />
                View Public URL
              </button>
              
              <hr className="my-2" />
              
              <button className="w-full flex items-center gap-2 px-4 py-2 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
                Delete Blog
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 