'use client';

import { useState } from 'react';
import { FileText, Video, ShieldAlert, Brain, Database, Activity, MessageCircle, List, Plus } from 'lucide-react';
import BlogGenerator from './components/BlogGenerator';
import BlogManager from './components/BlogManager';
import BlogEditor from './components/BlogEditor';
import VideoGenerator from './components/VideoGenerator';
import SafetyGenerator from './components/SafetyGenerator';

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState('blog');
  const [blogView, setBlogView] = useState<'generate' | 'manage' | 'edit'>('generate');
  const [selectedBlogId, setSelectedBlogId] = useState<number | undefined>();
  const [editorMode, setEditorMode] = useState<'edit' | 'view' | 'create'>('view');

  const handleCreateNewBlog = () => {
    setBlogView('edit');
    setEditorMode('create');
    setSelectedBlogId(undefined);
  };

  const handleBackToList = () => {
    setBlogView('manage');
    setSelectedBlogId(undefined);
  };

  const handleViewBlog = (id: number) => {
    setSelectedBlogId(id);
    setEditorMode('view');
    setBlogView('edit');
  };

  const handleEditBlog = (id: number) => {
    setSelectedBlogId(id);
    setEditorMode('edit');
    setBlogView('edit');
  };

  const renderBlogContent = () => {
    switch (blogView) {
      case 'generate':
        return <BlogGenerator />;
      case 'manage':
        return <BlogManager onCreateNew={handleCreateNewBlog} />;
      case 'edit':
        return (
          <BlogEditor 
            blogId={selectedBlogId}
            onBack={handleBackToList}
            mode={editorMode}
          />
        );
      default:
        return <BlogGenerator />;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          AI Content Generator
        </h1>
        <p className="text-lg text-gray-600">
          Create intelligent chemical content powered by RAG and specialized AI agents
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-2 mb-8">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('blog')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-semibold transition-all ${
              activeTab === 'blog'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md -translate-y-0.5'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-5 h-5" />
            Blog Post
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-semibold transition-all ${
              activeTab === 'video'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md -translate-y-0.5'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Video className="w-5 h-5" />
            Video Script
          </button>
          <button
            onClick={() => setActiveTab('safety')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-semibold transition-all ${
              activeTab === 'safety'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md -translate-y-0.5'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
            Safety Guide
          </button>
        </div>
      </div>

      {/* Blog Sub-Navigation */}
      {activeTab === 'blog' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setBlogView('generate')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                blogView === 'generate'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Plus className="w-4 h-4" />
              Generate New
            </button>
            <button
              onClick={() => setBlogView('manage')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                blogView === 'manage'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <List className="w-4 h-4" />
              Manage Blogs
            </button>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {activeTab === 'blog' && renderBlogContent()}
        {activeTab === 'video' && <VideoGenerator />}
        {activeTab === 'safety' && <SafetyGenerator />}
      </div>

      <button className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform">
        <MessageCircle className="w-6 h-6" />
      </button>
    </div>
  );
} 