'use client';

import { useState } from 'react';
import { ShieldAlert, AlertTriangle, FileText, Database, Activity, Play } from 'lucide-react';

interface Tag {
  id: string;
  text: string;
}

export default function SafetyGenerator() {
  const [safetyLevel, setSafetyLevel] = useState('basic');
  const [targetAudience, setTargetAudience] = useState('lab-technicians');
  const [writerPersona, setWriterPersona] = useState('safety-expert');
  const [blogTone, setBlogTone] = useState('informative_overview');
  const [technicalDepth, setTechnicalDepth] = useState('intermediate');
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-8">
      <div className="space-y-8">
        {/* Safety Information Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Safety Information</h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-2">Safety Level</label>
                <select 
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors"
                  value={safetyLevel}
                  onChange={(e) => setSafetyLevel(e.target.value)}
                >
                  <option value="basic">Basic Safety Guidelines</option>
                  <option value="intermediate">Intermediate Safety Protocols</option>
                  <option value="advanced">Advanced Safety Procedures</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-2">Target Audience</label>
                <select 
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                >
                  <option value="lab-technicians">Lab Technicians</option>
                  <option value="researchers">Researchers</option>
                  <option value="students">Students</option>
                  <option value="safety-officers">Safety Officers</option>
                  <option value="general-staff">General Staff</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Safety Focus Areas</label>
              <textarea
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors min-h-[120px]"
                placeholder="Specify key safety aspects to cover (e.g., handling, storage, disposal, emergency procedures)"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">Regulatory Compliance</label>
              <textarea
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors min-h-[120px]"
                placeholder="List relevant safety regulations and standards to reference"
              />
            </div>
          </div>
        </div>

        {/* Content Strategy Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Content Strategy</h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-2">Writer Persona</label>
                <select 
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors"
                  value={writerPersona}
                  onChange={(e) => setWriterPersona(e.target.value)}
                >
                  <option value="safety-expert">Safety Expert</option>
                  <option value="regulatory-specialist">Regulatory Specialist</option>
                  <option value="lab-manager">Lab Manager</option>
                  <option value="emergency-response">Emergency Response Expert</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-2">Content Tone</label>
                <select 
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors"
                  value={blogTone}
                  onChange={(e) => setBlogTone(e.target.value)}
                >
                  <option value="informative_overview">Informative Overview</option>
                  <option value="technical_deep_dive">Technical Deep Dive</option>
                  <option value="problem_solution">Problem/Solution</option>
                  <option value="case_study_focused">Case Study Focused</option>
                  <option value="educational_tutorial">Educational Tutorial</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Technical Depth</label>
              <select 
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors"
                value={technicalDepth}
                onChange={(e) => setTechnicalDepth(e.target.value)}
              >
                <option value="beginner">Beginner (Basic Safety Concepts)</option>
                <option value="intermediate">Intermediate (Detailed Protocols)</option>
                <option value="expert">Expert (Advanced Safety Analysis)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-2">Emergency Procedures</label>
              <textarea
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors min-h-[120px]"
                placeholder="Specify emergency procedures to include (e.g., spill response, first aid, evacuation)"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Safety Agent Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Safety Agent</h2>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setWriterPersona('safety-expert')}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                writerPersona === 'safety-expert'
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-gray-200 hover:border-indigo-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                writerPersona === 'safety-expert' ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold">Safety Expert</h4>
                <p className="text-sm opacity-80">Comprehensive safety protocols and guidelines</p>
              </div>
            </button>

            <button
              onClick={() => setWriterPersona('regulatory-specialist')}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                writerPersona === 'regulatory-specialist'
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-gray-200 hover:border-indigo-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                writerPersona === 'regulatory-specialist' ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                <Database className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold">Regulatory Specialist</h4>
                <p className="text-sm opacity-80">Compliance-focused safety documentation</p>
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
              Generate Safety Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 