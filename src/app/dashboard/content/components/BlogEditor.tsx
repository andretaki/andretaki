'use client';

import React, { useState, useEffect } from 'react';
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
  CheckCircle
} from 'lucide-react';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  productName: string;
  targetAudience: string;
  wordCount: number;
  keywords: string[];
  metaDescription: string;
  views?: number;
  engagement?: number;
}

interface BlogEditorProps {
  blogId?: number;
  onBack: () => void;
  mode: 'edit' | 'view' | 'create';
}

export default function BlogEditor({ blogId, onBack, mode }: BlogEditorProps) {
  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === 'edit' || mode === 'create');
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');

  useEffect(() => {
    if (mode === 'create') {
      setLoading(false);
      setIsEditing(true);
      return;
    }
    
    if (blogId) {
      fetchBlog();
    }
  }, [blogId, mode]);

  const fetchBlog = async () => {
    try {
      setLoading(true);
      // Mock data for now - replace with actual API call
      const mockBlog: BlogPost = {
        id: blogId || 1,
        title: "Benzyl Chloride Applications in Pharmaceutical Synthesis",
        slug: "benzyl-chloride-pharmaceutical-synthesis",
        content: `# Introduction

Benzyl chloride (C7H7Cl) is a crucial intermediate in pharmaceutical synthesis, offering unique reactivity patterns that make it indispensable in modern drug manufacturing. This comprehensive guide explores its applications, safety considerations, and best practices for laboratory use.

## Chemical Properties and Reactivity

Benzyl chloride exhibits exceptional electrophilic properties due to the electron-withdrawing effect of the chlorine atom adjacent to the benzyl carbon. This reactivity makes it particularly valuable in:

- **Nucleophilic substitution reactions** - Primary pathway for pharmaceutical intermediates
- **Alkylation processes** - Essential for drug scaffold modifications  
- **Cross-coupling reactions** - Modern synthetic approaches

## Key Applications in Drug Development

### 1. Antihistamine Synthesis
Benzyl chloride serves as a starting material for several antihistamine compounds, including:
- Diphenhydramine precursors
- Loratadine intermediates
- Novel H1-receptor antagonists

### 2. Antimicrobial Agents
The compound plays a vital role in synthesizing:
- Benzalkonium chloride derivatives
- Quaternary ammonium compounds
- Broad-spectrum antiseptics

### 3. CNS Drug Intermediates
Pharmaceutical applications include:
- Benzodiazepine precursors
- Antidepressant intermediates
- Anxiolytic compound synthesis

## Safety Protocols and Best Practices

Warning: **Critical Safety Information**

Benzyl chloride requires specialized handling due to its:
- Vesicant properties (causes severe skin blistering)
- Respiratory irritation potential
- Environmental sensitivity

### Recommended Safety Measures:
1. **Personal Protective Equipment**
   - Chemical-resistant gloves (nitrile recommended)
   - Full face shield or safety goggles
   - Lab coat with long sleeves
   - Closed-toe shoes

2. **Ventilation Requirements**
   - Use only in well-ventilated fume hoods
   - Minimum face velocity: 100 fpm
   - Emergency eyewash station within 10 feet

3. **Storage Guidelines**
   - Store in cool, dry location
   - Keep away from light and moisture
   - Use amber glass containers
   - Temperature range: 15-25°C

## Synthetic Methodologies

### Traditional Approach: Free Radical Chlorination
C6H5CH3 + Cl2 → C6H5CH2Cl + HCl
- Temperature: 400-500°C
- Catalyst: UV light or peroxides
- Yield: 70-85%

### Modern Alternative: Wohl-Ziegler Bromination
More selective approach using:
- N-bromosuccinimide (NBS)
- AIBN initiator
- Carbon tetrachloride solvent

## Regulatory Considerations

### Global Classifications:
- **OSHA**: Hazardous substance
- **REACH**: Registered with restrictions
- **GHS**: Category 2 acute toxicity

### Documentation Requirements:
- Safety Data Sheets (SDS)
- Exposure monitoring records
- Waste disposal documentation
- Training certificates

## Quality Control Parameters

Essential testing protocols include:

| Parameter | Specification | Method |
|-----------|---------------|---------|
| Purity | ≥99.0% | GC-MS |
| Water content | ≤0.05% | Karl Fischer |
| Color | Clear to pale yellow | Visual |
| Chloride content | 30.8-31.2% | Argentometric |

## Environmental Impact and Disposal

### Waste Management:
- Neutralize with sodium carbonate
- Incinerate at licensed facilities
- Document disposal chains
- Monitor groundwater if applicable

### Green Chemistry Alternatives:
Recent developments focus on:
- Photocatalytic chlorination
- Electrochemical methods
- Biocatalytic approaches

## Conclusion

Benzyl chloride remains an essential building block in pharmaceutical synthesis, but its use requires comprehensive safety protocols and environmental awareness. As the industry moves toward greener alternatives, understanding both traditional and emerging methodologies ensures optimal outcomes in drug development processes.

For additional resources and safety guidelines, consult your institutional chemical hygiene plan and coordinate with environmental health and safety personnel.

---

*This content is for educational purposes and should not replace professional safety training or institutional protocols.*`,
        status: 'published',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        productName: "Benzyl Chloride",
        targetAudience: "Research Scientists",
        wordCount: 1250,
        keywords: ["pharmaceutical", "synthesis", "organic chemistry", "safety", "benzyl chloride"],
        metaDescription: "Explore the key applications of benzyl chloride in pharmaceutical synthesis, including safety protocols and modern synthetic methodologies.",
        views: 1240,
        engagement: 85
      };

      setBlog(mockBlog);
      setTitle(mockBlog.title);
      setContent(mockBlog.content);
      setMetaDescription(mockBlog.metaDescription);
      setKeywords(mockBlog.keywords);
      setStatus(mockBlog.status);
    } catch (error) {
      console.error('Failed to fetch blog:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updatedBlog = {
        title,
        content,
        metaDescription,
        keywords,
        status,
        wordCount: content.split(/\s+/).length
      };

      // Mock API call - replace with actual implementation
      console.log('Saving blog:', updatedBlog);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setHasChanges(false);
      
      // Show success message
      alert('Blog saved successfully!');
      
    } catch (error) {
      console.error('Failed to save blog:', error);
      alert('Failed to save blog. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setStatus('published');
    await handleSave();
  };

  const handleInputChange = (field: string, value: any) => {
    setHasChanges(true);
    switch (field) {
      case 'title':
        setTitle(value);
        break;
      case 'content':
        setContent(value);
        break;
      case 'metaDescription':
        setMetaDescription(value);
        break;
      case 'keywords':
        setKeywords(value);
        break;
      case 'status':
        setStatus(value);
        break;
    }
  };

  const addKeyword = (keyword: string) => {
    if (keyword.trim() && !keywords.includes(keyword.trim())) {
      handleInputChange('keywords', [...keywords, keyword.trim()]);
    }
  };

  const removeKeyword = (index: number) => {
    handleInputChange('keywords', keywords.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
          
          {blog && (
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
              {blog.views !== undefined && (
                <span className="text-sm text-gray-500">
                  {blog.views.toLocaleString()} views
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
          
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
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

          {isEditing && (
            <>
              <button
                onClick={handleSave}
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
                  onClick={handlePublish}
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
            {isEditing ? (
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
                
                {blog && (
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-8 pb-6 border-b border-gray-200">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(blog.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                    <span>•</span>
                    <span>{blog.wordCount} words</span>
                    <span>•</span>
                    <span>{Math.ceil(blog.wordCount / 200)} min read</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Tag className="w-4 h-4" />
                      {blog.productName}
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
              {isEditing && (
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
                {isEditing ? (
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
                      {isEditing && (
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
                {isEditing && (
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

              {blog && (
                <>
                  <div className="pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Created</p>
                        <p className="font-medium">
                          {new Date(blog.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Updated</p>
                        <p className="font-medium">
                          {new Date(blog.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {blog.views !== undefined && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Views</p>
                          <p className="font-medium">{blog.views.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Engagement</p>
                          <p className="font-medium">{blog.engagement}%</p>
                        </div>
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