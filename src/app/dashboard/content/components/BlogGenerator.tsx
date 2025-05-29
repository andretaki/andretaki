'use client';

import { useState } from 'react';
import { Package, Target, Brain, Database, Activity, Play } from 'lucide-react';

interface Tag {
  id: string;
  text: string;
}

export default function BlogGenerator() {
  const [keywords, setKeywords] = useState<Tag[]>([
    { id: '1', text: 'pharmaceutical synthesis' },
    { id: '2', text: 'organic chemistry' }
  ]);
  const [newKeyword, setNewKeyword] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('innovator');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newKeyword.trim()) {
      e.preventDefault();
      setKeywords([...keywords, { id: Date.now().toString(), text: newKeyword.trim() }]);
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (id: string) => {
    setKeywords(keywords.filter(tag => tag.id !== id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-8">
      <div className="space-y-8">
        {/* Product Information Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Package className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Product Information</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block font-semibold mb-2">Product Name</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors"
                placeholder="e.g., Benzyl Chloride"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block font-semibold mb-2">CAS Number</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">#</span>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors font-mono"
                    placeholder="100-44-7"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block font-semibold mb-2">Chemical Formula</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">⚛</span>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors font-mono"
                    placeholder="C₇H₇Cl"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Product Description</label>
              <textarea
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors min-h-[120px]"
                placeholder="Brief description of the chemical product..."
              />
            </div>
          </div>
        </div>

        {/* Content Strategy Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Target className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Content Strategy</h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-2">Target Audience</label>
                <select className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors">
                  <option value="research-scientists">Research Scientists</option>
                  <option value="lab-managers">Lab Managers</option>
                  <option value="procurement">Procurement Specialists</option>
                  <option value="students">Chemistry Students</option>
                  <option value="general">General Industry</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-2">Content Type</label>
                <select className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors">
                  <option value="technical_deep_dive">Technical Deep Dive</option>
                  <option value="informative_overview">Informative Overview</option>
                  <option value="problem_solution">Problem/Solution</option>
                  <option value="case_study_focused">Case Study</option>
                  <option value="educational_tutorial">Educational Tutorial</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Keywords & Topics</label>
              <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition-colors">
                {keywords.map(tag => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-full text-sm"
                  >
                    {tag.text}
                    <button
                      onClick={() => handleRemoveKeyword(tag.id)}
                      className="hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={handleAddKeyword}
                  className="flex-1 min-w-[120px] outline-none bg-transparent"
                  placeholder="Add keywords..."
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Specific Focus Areas</label>
              <textarea
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors min-h-[120px]"
                placeholder="What specific aspects should the content focus on? (applications, safety, synthesis, etc.)"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* AI Agent Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">AI Agent</h2>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setSelectedAgent('innovator')}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedAgent === 'innovator'
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-gray-200 hover:border-indigo-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedAgent === 'innovator' ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                <Brain className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold">Innovator Agent</h4>
                <p className="text-sm opacity-80">Generates creative applications and insights</p>
              </div>
            </button>

            <button
              onClick={() => setSelectedAgent('architect')}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedAgent === 'architect'
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-gray-200 hover:border-indigo-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedAgent === 'architect' ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                <Database className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold">Architect Agent</h4>
                <p className="text-sm opacity-80">Structures comprehensive technical content</p>
              </div>
            </button>
          </div>
        </div>

        {/* Generation Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Generation Status</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 rounded-lg text-gray-600">
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
              Ready to Generate
            </div>

            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300" style={{ width: isGenerating ? '75%' : '0%' }} />
            </div>

            <button
              onClick={() => setIsGenerating(!isGenerating)}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isGenerating}
            >
              <Play className="w-5 h-5" />
              Generate Blog Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 