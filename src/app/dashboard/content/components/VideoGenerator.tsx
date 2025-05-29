'use client';

import { useState } from 'react';
import { Video, Palette, GraduationCap, Zap, Shield, Activity, Play } from 'lucide-react';

interface Tag {
  id: string;
  text: string;
}

export default function VideoGenerator() {
  const [visualElements, setVisualElements] = useState<Tag[]>([
    { id: '1', text: 'molecular structure' },
    { id: '2', text: 'lab equipment' },
    { id: '3', text: 'safety gear' }
  ]);
  const [newElement, setNewElement] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('professor');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAddElement = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newElement.trim()) {
      e.preventDefault();
      setVisualElements([...visualElements, { id: Date.now().toString(), text: newElement.trim() }]);
      setNewElement('');
    }
  };

  const handleRemoveElement = (id: string) => {
    setVisualElements(visualElements.filter(tag => tag.id !== id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-8">
      <div className="space-y-8">
        {/* Video Specifications Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Video className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Video Specifications</h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-2">Platform</label>
                <select className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors">
                  <option value="youtube">YouTube</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-2">Duration</label>
                <select className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors">
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="90">90 seconds</option>
                  <option value="120">2 minutes</option>
                  <option value="300">5 minutes</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Video Style</label>
              <select className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors">
                <option value="educational">Educational</option>
                <option value="promotional">Promotional</option>
                <option value="demonstration">Demonstration</option>
                <option value="safety-focused">Safety Focused</option>
                <option value="case-study">Case Study</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-2">Key Message</label>
              <textarea
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors min-h-[120px]"
                placeholder="What's the main message or call-to-action for this video?"
              />
            </div>
          </div>
        </div>

        {/* Visual & Audio Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Visual & Audio</h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-2">Visual Style</label>
                <select className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors">
                  <option value="modern">Modern & Clean</option>
                  <option value="scientific">Scientific & Technical</option>
                  <option value="industrial">Industrial & Professional</option>
                  <option value="educational">Educational & Friendly</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-2">Voice Type</label>
                <select className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors">
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="authoritative">Authoritative</option>
                  <option value="conversational">Conversational</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Visual Elements to Include</label>
              <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition-colors">
                {visualElements.map(tag => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-full text-sm"
                  >
                    {tag.text}
                    <button
                      onClick={() => handleRemoveElement(tag.id)}
                      className="hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={newElement}
                  onChange={(e) => setNewElement(e.target.value)}
                  onKeyPress={handleAddElement}
                  className="flex-1 min-w-[120px] outline-none bg-transparent"
                  placeholder="Add visual elements..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Video Personas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Video Personas</h2>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setSelectedPersona('professor')}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedPersona === 'professor'
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-gray-200 hover:border-indigo-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedPersona === 'professor' ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold">Professor</h4>
                <p className="text-sm opacity-80">Authoritative, educational tone</p>
              </div>
            </button>

            <button
              onClick={() => setSelectedPersona('innovator')}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedPersona === 'innovator'
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-gray-200 hover:border-indigo-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedPersona === 'innovator' ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                <Zap className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold">Innovator</h4>
                <p className="text-sm opacity-80">Energetic, forward-thinking</p>
              </div>
            </button>

            <button
              onClick={() => setSelectedPersona('safety')}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedPersona === 'safety'
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-gray-200 hover:border-indigo-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedPersona === 'safety' ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                <Shield className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold">Safety Expert</h4>
                <p className="text-sm opacity-80">Cautious, detailed approach</p>
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
              Generate Script
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 