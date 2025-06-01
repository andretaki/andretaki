'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Edit3, 
  Eye, 
  Trash2, 
  Clock, 
  CheckCircle, 
  Globe, 
  Calendar,
  Tag,
  BarChart3,
  Download,
  Share2,
  Copy,
  MoreHorizontal,
  Plus,
  ArrowUpRight,
  Bookmark,
  Star,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Loader
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

interface BlogManagerProps {
  onCreateNew?: () => void;
  onViewBlog: (id: number) => void;
  onEditBlog: (id: number) => void;
}

// Move helper functions outside of component
const getStatusColor = (status: string) => {
  switch (status) {
    case 'published': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'draft': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'archived': return 'bg-gray-100 text-gray-700 border-gray-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'published': return <Globe className="w-3 h-3" />;
    case 'draft': return <Clock className="w-3 h-3" />;
    case 'archived': return <Bookmark className="w-3 h-3" />;
    default: return <FileText className="w-3 h-3" />;
  }
};

export default function BlogManager({ onCreateNew, onViewBlog, onEditBlog }: BlogManagerProps) {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [selectedBlogs, setSelectedBlogs] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [totalBlogs, setTotalBlogs] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const blogsPerPage = 10;

  const fetchBlogs = async (page = 0, append = false) => {
    try {
      setLoading(true);
      setError(null);
      const offset = page * blogsPerPage;

      const params = new URLSearchParams({
        limit: blogsPerPage.toString(),
        offset: offset.toString(),
        sortBy,
        sortOrder,
      });
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/blogs?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch blogs (status ${response.status})`);
      }
      const data = await response.json();
      if (data.success) {
        setBlogs(prev => append ? [...prev, ...data.blogs] : data.blogs);
        setTotalBlogs(data.total);
        setHasMore(data.hasMore);
        setCurrentPage(page);
      } else {
        throw new Error(data.error || 'Invalid response format from blogs API');
      }
    } catch (error) {
      console.error('Failed to fetch blogs:', error);
      setError(error instanceof Error ? error.message : String(error));
      if (!append) setBlogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs(0, false);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(0);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as any);
    setCurrentPage(0);
  };

  const handleSortChange = (newSortBy: string) => {
    setCurrentPage(0);
    if (newSortBy === sortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchBlogs(currentPage + 1, true);
    }
  };

  const handleBulkAction = async (action: 'publish' | 'archive' | 'delete') => {
    if (selectedBlogs.length === 0) {
      alert('Please select at least one blog post.');
      return;
    }

    const confirmMessage = {
      publish: 'Are you sure you want to publish the selected blog posts?',
      archive: 'Are you sure you want to archive the selected blog posts?',
      delete: 'Are you sure you want to delete the selected blog posts? This action cannot be undone.'
    }[action];

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const promises = selectedBlogs.map(async (blogId) => {
        if (action === 'delete') {
          const response = await fetch(`/api/blogs/${blogId}`, {
            method: 'DELETE'
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to delete blog ${blogId}`);
          }
        } else {
          const response = await fetch(`/api/blogs/${blogId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: action === 'publish' ? 'published' : 'archived'
            })
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to ${action} blog ${blogId}`);
          }
        }
      });

      await Promise.all(promises);
      setSelectedBlogs([]);
      fetchBlogs(); // Refresh the list
      alert(`Successfully ${action}ed ${selectedBlogs.length} blog post(s).`);
    } catch (error) {
      console.error(`Failed to ${action} blogs:`, error);
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (loading && currentPage === 0 && blogs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading blogs...</p>
        </div>
      </div>
    );
  }

  if (error && blogs.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Blogs</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          onClick={() => fetchBlogs(0, false)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const SortableHeader = ({ columnKey, children }: { columnKey: string; children: React.ReactNode }) => (
    <button 
      onClick={() => handleSortChange(columnKey)} 
      className="flex items-center gap-1 hover:text-indigo-600"
    >
      {children}
      {sortBy === columnKey && (
        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Blog Management</h1>
          <p className="text-gray-600 mt-1">
            Manage your AI-generated chemical content • {totalBlogs} total blogs
          </p>
        </div>
        <button 
          onClick={onCreateNew}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
        >
          <Plus className="w-4 h-4" />
          Create New Blog
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Globe className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Published</p>
              <p className="text-2xl font-bold text-gray-900">
                {blogs.filter(b => b.status === 'published').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Drafts</p>
              <p className="text-2xl font-bold text-gray-900">
                {blogs.filter(b => b.status === 'draft').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Views</p>
              <p className="text-2xl font-bold text-gray-900">
                {blogs.reduce((sum, b) => sum + (b.views || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Star className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg. Engagement</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(blogs.reduce((sum, b) => sum + (b.engagement || 0), 0) / blogs.length) || 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search title, meta, product..."
                value={searchTerm}
                onChange={handleSearchInputChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>

            <div className="relative group">
              <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1">
                <Filter className="w-4 h-4" /> Sort By
              </button>
              <div className="absolute z-10 mt-1 w-48 bg-white rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
                <div className="py-1">
                  {[
                    { key: 'updatedAt', label: 'Last Updated' },
                    { key: 'createdAt', label: 'Created Date' },
                    { key: 'title', label: 'Title' },
                    { key: 'status', label: 'Status' },
                    { key: 'wordCount', label: 'Word Count' },
                    { key: 'views', label: 'Views' }
                  ].map(({ key, label }) => (
                    <a
                      key={key}
                      href="#"
                      onClick={(e) => { e.preventDefault(); handleSortChange(key); }}
                      className={`block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${
                        sortBy === key ? 'font-semibold text-indigo-600' : ''
                      }`}
                    >
                      {label}
                      {sortBy === key && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedBlogs.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{selectedBlogs.length} selected</span>
                <button 
                  onClick={() => handleBulkAction('publish')}
                  className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-md text-sm hover:bg-emerald-200 transition-colors"
                >
                  Publish
                </button>
                <button 
                  onClick={() => handleBulkAction('archive')}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
                >
                  Archive
                </button>
                <button 
                  onClick={() => handleBulkAction('delete')}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
            
            <div className="flex border border-gray-200 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400'}`}
              >
                <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                </div>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400'}`}
              >
                <div className="w-4 h-4 flex flex-col gap-0.5">
                  <div className="bg-current h-0.5 rounded"></div>
                  <div className="bg-current h-0.5 rounded"></div>
                  <div className="bg-current h-0.5 rounded"></div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Blog Grid/List */}
      {blogs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No blogs found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filters' 
              : 'Create your first AI-generated blog post'}
          </p>
          <button 
            onClick={onCreateNew}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Create New Blog
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
          : "space-y-4"
        }>
          {blogs.map((blog) => (
            <BlogCard
              key={blog.id}
              blog={blog}
              viewMode={viewMode}
              isSelected={selectedBlogs.includes(blog.id)}
              onSelect={(selected) => {
                if (selected) {
                  setSelectedBlogs([...selectedBlogs, blog.id]);
                } else {
                  setSelectedBlogs(selectedBlogs.filter(id => id !== blog.id));
                }
              }}
              onViewBlog={() => onViewBlog(blog.id)}
              onEditBlog={() => onEditBlog(blog.id)}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Load More
          </button>
        </div>
      )}

      {/* Loading Indicator for Pagination */}
      {loading && currentPage > 0 && (
        <div className="text-center py-4">
          <Loader className="animate-spin w-6 h-6 text-indigo-600 mx-auto" />
        </div>
      )}
    </div>
  );
}

interface BlogCardProps {
  blog: BlogPost;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onViewBlog: () => void;
  onEditBlog: () => void;
}

const BlogCard: React.FC<BlogCardProps> = ({ 
  blog, 
  viewMode, 
  isSelected, 
  onSelect,
  onViewBlog,
  onEditBlog
}) => {
  // Update the buttons in both list and grid views
  const actionButtons = (
    <div className="flex items-center gap-2">
      <button 
        onClick={onViewBlog}
        className="flex items-center gap-1 px-3 py-1 text-indigo-600 bg-indigo-50 rounded-md text-sm hover:bg-indigo-100 transition-colors"
      >
        <Eye className="w-3 h-3" />
        View
      </button>
      <button 
        onClick={onEditBlog}
        className="flex items-center gap-1 px-3 py-1 text-gray-600 bg-gray-50 rounded-md text-sm hover:bg-gray-100 transition-colors"
      >
        <Edit3 className="w-3 h-3" />
        Edit
      </button>
    </div>
  );

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-all">
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          />
          
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 hover:text-indigo-600 cursor-pointer">
                {blog.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(blog.status)}`}>
                  {getStatusIcon(blog.status)}
                  {blog.status}
                </span>
                <button className="p-1 text-gray-400 hover:text-gray-600">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(blog.createdAt).toLocaleDateString()}
              </span>
              <span>{blog.wordCount} words</span>
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {blog.productName}
              </span>
              {blog.views && (
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {blog.views} views
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              {blog.keywords.slice(0, 3).map((keyword, index) => (
                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                  {keyword}
                </span>
              ))}
              {blog.keywords.length > 3 && (
                <span className="text-xs text-gray-500">+{blog.keywords.length - 3} more</span>
              )}
            </div>
            
            {actionButtons}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 group">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          />
          <button className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-indigo-600 cursor-pointer">
          {blog.title}
        </h3>
        
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
          {blog.metaDescription}
        </p>
        
        <div className="flex items-center gap-2 mb-4">
          {blog.keywords.slice(0, 2).map((keyword, index) => (
            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
              {keyword}
            </span>
          ))}
          {blog.keywords.length > 2 && (
            <span className="text-xs text-gray-500">+{blog.keywords.length - 2}</span>
          )}
        </div>
        
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(blog.createdAt).toLocaleDateString()}
          </span>
          <span>{blog.wordCount} words</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(blog.status)}`}>
            {getStatusIcon(blog.status)}
            {blog.status}
          </span>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={onViewBlog}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button 
              onClick={onEditBlog}
              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {blog.views !== undefined && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {blog.views} views
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                {blog.engagement}% engagement
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 