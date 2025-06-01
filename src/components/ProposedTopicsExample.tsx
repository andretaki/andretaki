'use client';

import React, { useState, useEffect } from 'react';

// Types based on our database schema
interface ProposedTopic {
  id: number;
  topicTitle: string;
  status: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  priorityScore?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  sourceType: string;
  strategicTheme?: string;
  product?: {
    title: string;
    handle: string;
  };
}

interface FilterState {
  status: string;
  searchTerm: string;
  sortBy: 'createdAt' | 'priorityScore' | 'updatedAt' | 'topicTitle';
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}

export default function ProposedTopicsExample() {
  const [topics, setTopics] = useState<ProposedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    searchTerm: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    limit: 10,
    offset: 0,
  });

  const [newTopic, setNewTopic] = useState({
    topicTitle: '',
    primaryKeyword: '',
    notes: '',
    priorityScore: 5,
  });

  // Fetch topics from API
  const fetchTopics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });

      const response = await fetch(`/api/marketing/proposed-topics?${params}`);
      const data = await response.json();

      if (data.success) {
        setTopics(data.topics);
        setTotalCount(data.totalCount);
      } else {
        setError(data.error || 'Failed to fetch topics');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Create new topic
  const createTopic = async () => {
    if (!newTopic.topicTitle.trim()) {
      alert('Topic title is required');
      return;
    }

    try {
      const response = await fetch('/api/marketing/proposed-topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newTopic,
          sourceType: 'manual_entry',
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Topic created successfully!');
        setNewTopic({ topicTitle: '', primaryKeyword: '', notes: '', priorityScore: 5 });
        setShowCreateForm(false);
        fetchTopics(); // Refresh the list
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Network error occurred');
    }
  };

  // Update topic status
  const updateTopicStatus = async (topicId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/marketing/proposed-topics/${topicId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Topic status updated to ${newStatus}`);
        fetchTopics(); // Refresh the list
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Network error occurred');
    }
  };

  // Delete topic
  const deleteTopic = async (topicId: number) => {
    if (!confirm('Are you sure you want to delete this topic?')) {
      return;
    }

    try {
      const response = await fetch(`/api/marketing/proposed-topics/${topicId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        alert('Topic deleted successfully');
        fetchTopics(); // Refresh the list
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Network error occurred');
    }
  };

  useEffect(() => {
    fetchTopics();
  }, [filters]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'proposed': return 'bg-yellow-100 text-yellow-800';
      case 'approved_for_pipeline': return 'bg-green-100 text-green-800';
      case 'pipeline_active': return 'bg-blue-100 text-blue-800';
      case 'published': return 'bg-emerald-100 text-emerald-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Proposed Topics Management</h1>
        
        {/* Header Actions */}
        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {showCreateForm ? 'Cancel' : '+ Create New Topic'}
          </button>
          <button
            onClick={fetchTopics}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create New Topic</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic Title *
                </label>
                <input
                  type="text"
                  value={newTopic.topicTitle}
                  onChange={(e) => setNewTopic({...newTopic, topicTitle: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Enter topic title..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Keyword
                </label>
                <input
                  type="text"
                  value={newTopic.primaryKeyword}
                  onChange={(e) => setNewTopic({...newTopic, primaryKeyword: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Enter primary keyword..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority Score (0-10)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={newTopic.priorityScore}
                  onChange={(e) => setNewTopic({...newTopic, priorityScore: parseFloat(e.target.value)})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={newTopic.notes}
                  onChange={(e) => setNewTopic({...newTopic, notes: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Enter notes..."
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={createTopic}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Create Topic
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value, offset: 0})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Statuses</option>
                <option value="proposed">Proposed</option>
                <option value="approved_for_pipeline">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => setFilters({...filters, searchTerm: e.target.value, offset: 0})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Search topics..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({...filters, sortBy: e.target.value as any})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="createdAt">Created Date</option>
                <option value="updatedAt">Updated Date</option>
                <option value="topicTitle">Title</option>
                <option value="priorityScore">Priority Score</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
              <select
                value={filters.sortOrder}
                onChange={(e) => setFilters({...filters, sortOrder: e.target.value as any})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading topics...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Topics Table */}
      {!loading && !error && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Topics ({totalCount})</h2>
          </div>
          
          {topics.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No topics found. Create your first topic!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Topic Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {topics.map((topic) => (
                    <tr key={topic.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{topic.topicTitle}</div>
                        {topic.primaryKeyword && (
                          <div className="text-sm text-gray-500">Keyword: {topic.primaryKeyword}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(topic.status)}`}>
                          {topic.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {topic.priorityScore ? `${topic.priorityScore}/10` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {topic.sourceType.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(topic.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium space-x-2">
                        {topic.status === 'proposed' && (
                          <button
                            onClick={() => updateTopicStatus(topic.id, 'approved_for_pipeline')}
                            className="text-green-600 hover:text-green-900"
                          >
                            ✅ Approve
                          </button>
                        )}
                        {topic.status === 'proposed' && (
                          <button
                            onClick={() => updateTopicStatus(topic.id, 'rejected')}
                            className="text-red-600 hover:text-red-900"
                          >
                            ❌ Reject
                          </button>
                        )}
                        <button
                          onClick={() => deleteTopic(topic.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {totalCount > filters.limit && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {filters.offset + 1} to {Math.min(filters.offset + filters.limit, totalCount)} of {totalCount} topics
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilters({...filters, offset: Math.max(0, filters.offset - filters.limit)})}
                  disabled={filters.offset === 0}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setFilters({...filters, offset: filters.offset + filters.limit})}
                  disabled={filters.offset + filters.limit >= totalCount}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 