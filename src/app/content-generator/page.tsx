'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Video, ShieldAlert, Package, Target, Brain, Database, 
  Activity, Play, Circle, CheckCircle, Edit, Copy, Download, Send,
  Hash, Atom, Lightbulb, Building, PenTool, GraduationCap, Zap,
  Shield, MessageCircle, Loader, Palette, ChevronDown, Search, Bell, Filter, PlusCircle, X
} from 'lucide-react';

type TabType = 'blog' | 'video' | 'safety';
type AgentType = 'innovator' | 'architect' | 'scribe' | 'professor' | 'safety-expert';
type GenerationStatus = 'idle' | 'processing' | 'complete' | 'error';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder: string;
  id?: string;
}

const TagInput: React.FC<TagInputProps> = ({ tags, onTagsChange, placeholder, id }) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !tags.includes(trimmedValue)) {
      onTagsChange([...tags, trimmedValue]);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg bg-gray-50 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 min-h-[2.875rem] items-center">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-primary-600 text-white rounded-full text-sm font-medium">
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="w-4 h-4 rounded-full hover:bg-white/20 flex items-center justify-center text-xs"
            aria-label={`Remove ${tag}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder={placeholder}
        className="flex-1 border-none outline-none bg-transparent text-gray-900 min-w-[120px] p-1 placeholder-gray-500"
      />
    </div>
  );
};

interface AgentSelectorProps {
  agents: Array<{
    id: AgentType;
    name: string;
    description: string;
    icon: React.ReactNode;
  }>;
  selectedAgent: AgentType;
  onAgentChange: (agent: AgentType) => void;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({ agents, selectedAgent, onAgentChange }) => {
  return (
    <div className="flex flex-col gap-3">
      {agents.map((agent) => (
        <div
          key={agent.id}
          role="button"
          tabIndex={0}
          onClick={() => onAgentChange(agent.id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onAgentChange(agent.id)}
          className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
            selectedAgent === agent.id
              ? 'border-primary-600 bg-primary-600 text-white shadow-lg'
              : 'border-gray-300 hover:border-primary-500 hover:bg-gray-50'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            selectedAgent === agent.id 
              ? 'bg-white/20 text-white' 
              : 'bg-gray-100 text-primary-600'
          }`}>
            {agent.icon}
          </div>
          <div>
            <h4 className="font-semibold">{agent.name}</h4>
            <p className={`text-sm ${
              selectedAgent === agent.id ? 'text-white/80' : 'text-gray-600'
            }`}>
              {agent.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

// Common input field component
const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string, icon?: React.ReactNode }> = ({ label, icon, id, ...props }) => (
  <div>
    <label htmlFor={id} className="block font-semibold mb-1.5 text-gray-700">{label}</label>
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10">{icon}</div>}
      <input
        id={id}
        {...props}
        className={`w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:bg-white transition-colors ${icon ? 'pl-10' : ''}`}
      />
    </div>
  </div>
);

const TextAreaField: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string, id?: string }> = ({ label, id, ...props }) => (
  <div>
    <label htmlFor={id} className="block font-semibold mb-1.5 text-gray-700">{label}</label>
    <textarea
      id={id}
      {...props}
      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:bg-white transition-colors min-h-[120px] resize-vertical"
    />
  </div>
);

const SelectField: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string, id?: string }> = ({ label, children, id, ...props }) => (
   <div>
    <label htmlFor={id} className="block font-semibold mb-1.5 text-gray-700">{label}</label>
    <div className="relative">
        <select
          id={id}
          {...props}
          className="w-full appearance-none px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:bg-white transition-colors"
        >
            {children}
        </select>
        <ChevronDown size={18} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
   </div>
);

const ContentGeneratorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('blog');
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [generatedContentPreview, setGeneratedContentPreview] = useState<any>(null);

  const [blogForm, setBlogForm] = useState({
    productName: '', casNumber: '', chemicalFormula: '', productDescription: '',
    targetAudience: 'research-scientists', contentType: 'technical_deep_dive',
    keywords: ['pharmaceutical synthesis', 'organic chemistry'], focusAreas: '',
    selectedAgent: 'innovator' as AgentType
  });

  const [videoForm, setVideoForm] = useState({
    platform: 'youtube', duration: '60', style: 'educational', message: '',
    visualStyle: 'modern', voiceType: 'professional',
    visualElements: ['molecular structure', 'lab equipment', 'safety gear'],
    selectedAgent: 'professor' as AgentType
  });

  const [safetyForm, setSafetyForm] = useState({
    safetyLevel: 'intermediate', hazardCategories: ['carcinogenic', 'lachrymator', 'reactive'],
    workEnvironment: 'research-lab', considerations: ''
  });

  const blogAgents = [
    { id: 'innovator' as AgentType, name: 'Innovator Agent', description: 'Generates creative applications and insights', icon: <Lightbulb size={20} /> },
    { id: 'architect' as AgentType, name: 'Architect Agent', description: 'Structures comprehensive technical content', icon: <Building size={20} /> },
    { id: 'scribe' as AgentType, name: 'Scribe Agent', description: 'Writes polished, publication-ready content', icon: <PenTool size={20} /> }
  ];

  const videoAgents = [
    { id: 'professor' as AgentType, name: 'Professor Persona', description: 'Authoritative, educational tone', icon: <GraduationCap size={20} /> },
    { id: 'innovator' as AgentType, name: 'Innovator Persona', description: 'Energetic, forward-thinking style', icon: <Zap size={20} /> },
    { id: 'safety-expert' as AgentType, name: 'Safety Expert Persona', description: 'Cautious, detailed safety approach', icon: <Shield size={20} /> }
  ];

  const handleGenerate = async () => {
    setGenerationStatus('processing');
    setProgress(0);
    setShowResults(false);
    setGeneratedContentPreview(null);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 95));
    }, 300);

    try {
      let apiEndpoint = '';
      let payload: any = {};

      switch (activeTab) {
        case 'blog':
          apiEndpoint = '/api/generate/blog';
          payload = {
            focusType: 'general_theme',
            focusValue: blogForm.productName || 'General Chemical Topics',
            targetAudience: blogForm.targetAudience,
            contentType: blogForm.contentType,
            productInfo: {
              name: blogForm.productName, cas: blogForm.casNumber,
              formula: blogForm.chemicalFormula, description: blogForm.productDescription
            },
            keywords: blogForm.keywords, focusAreas: blogForm.focusAreas,
            selectedAgent: blogForm.selectedAgent
          };
          break;
        case 'video':
          apiEndpoint = '/api/generate/video-script';
          payload = videoForm;
          break;
        case 'safety':
          apiEndpoint = '/api/generate/safety-guide';
          payload = safetyForm;
          break;
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status} ${await response.text()}`);
      
      const result = await response.json();
      setGeneratedContentPreview(result);

      clearInterval(progressInterval);
      setProgress(100);
      setGenerationStatus('complete');
      setShowResults(true);

      setTimeout(() => { setGenerationStatus('idle'); setProgress(0); }, 5000);

    } catch (error) {
      clearInterval(progressInterval);
      setGenerationStatus('error');
      console.error('Generation failed:', error);
      setGeneratedContentPreview({ error: error instanceof Error ? error.message : String(error) });
      setShowResults(true);
    }
  };

  const getStatusIndicator = () => {
    const statusConfig = {
      idle: { icon: Circle, text: 'Ready to generate', className: 'text-gray-500' },
      processing: { icon: Loader, text: 'Generating content...', className: 'text-primary-600 animate-spin' },
      complete: { icon: CheckCircle, text: 'Content generated!', className: 'text-green-600' },
      error: { icon: X, text: 'Generation failed', className: 'text-red-600' }
    };

    const config = statusConfig[generationStatus];
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-2 ${config.className}`}>
        <Icon size={16} />
        <span className="text-sm font-medium">{config.text}</span>
      </div>
    );
  };
  
  // Form components
  const renderBlogForm = () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
          <Package size={20} className="text-primary-600" />
          Product Information
        </h3>
        <div className="space-y-4">
          <InputField 
            label="Product Name" 
            id="productName" 
            value={blogForm.productName} 
            onChange={(e) => setBlogForm(prev => ({ ...prev, productName: e.target.value }))} 
            placeholder="e.g., Benzyl Chloride" 
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField 
              label="CAS Number" 
              id="casNumber" 
              icon={<Hash size={16} />} 
              value={blogForm.casNumber} 
              onChange={(e) => setBlogForm(prev => ({ ...prev, casNumber: e.target.value }))} 
              placeholder="100-44-7" 
            />
            <InputField 
              label="Chemical Formula" 
              id="chemicalFormula" 
              icon={<Atom size={16} />} 
              value={blogForm.chemicalFormula} 
              onChange={(e) => setBlogForm(prev => ({ ...prev, chemicalFormula: e.target.value }))} 
              placeholder="C₇H₇Cl" 
            />
          </div>
          <TextAreaField 
            label="Product Description" 
            id="productDescription" 
            value={blogForm.productDescription} 
            onChange={(e) => setBlogForm(prev => ({ ...prev, productDescription: e.target.value }))} 
            placeholder="Brief description of the chemical product..." 
          />
        </div>
      </section>
      <section>
        <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
          <Target size={20} className="text-primary-600"/>
          Content Strategy
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField 
              label="Target Audience" 
              id="targetAudience" 
              value={blogForm.targetAudience} 
              onChange={(e) => setBlogForm(prev => ({ ...prev, targetAudience: e.target.value }))}
            >
              <option value="research-scientists">Research Scientists</option>
              <option value="lab-managers">Lab Managers</option>
              <option value="procurement">Procurement Specialists</option>
            </SelectField>
            <SelectField 
              label="Content Type" 
              id="contentType" 
              value={blogForm.contentType} 
              onChange={(e) => setBlogForm(prev => ({ ...prev, contentType: e.target.value }))}
            >
              <option value="technical_deep_dive">Technical Deep Dive</option>
              <option value="informative_overview">Informative Overview</option>
            </SelectField>
          </div>
          <div>
            <label htmlFor="keywords" className="block font-semibold mb-1.5 text-gray-700">Keywords & Topics</label>
            <TagInput 
              id="keywords" 
              tags={blogForm.keywords} 
              onTagsChange={(tags) => setBlogForm(prev => ({ ...prev, keywords: tags }))} 
              placeholder="Add keywords..." 
            />
          </div>
          <TextAreaField 
            label="Specific Focus Areas" 
            id="focusAreas" 
            value={blogForm.focusAreas} 
            onChange={(e) => setBlogForm(prev => ({ ...prev, focusAreas: e.target.value }))} 
            placeholder="Applications, safety, synthesis..." 
          />
        </div>
      </section>
    </div>
  );

  const renderVideoForm = () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
          <Video size={20} className="text-primary-600" />
          Video Configuration
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectField 
              label="Platform" 
              id="platform" 
              value={videoForm.platform} 
              onChange={(e) => setVideoForm(prev => ({ ...prev, platform: e.target.value }))}
            >
              <option value="youtube">YouTube</option>
              <option value="linkedin">LinkedIn</option>
              <option value="tiktok">TikTok</option>
            </SelectField>
            <SelectField 
              label="Duration" 
              id="duration" 
              value={videoForm.duration} 
              onChange={(e) => setVideoForm(prev => ({ ...prev, duration: e.target.value }))}
            >
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="120">2 minutes</option>
              <option value="300">5 minutes</option>
            </SelectField>
            <SelectField 
              label="Style" 
              id="style" 
              value={videoForm.style} 
              onChange={(e) => setVideoForm(prev => ({ ...prev, style: e.target.value }))}
            >
              <option value="educational">Educational</option>
              <option value="promotional">Promotional</option>
              <option value="tutorial">Tutorial</option>
            </SelectField>
          </div>
          <TextAreaField 
            label="Key Message" 
            id="message" 
            value={videoForm.message} 
            onChange={(e) => setVideoForm(prev => ({ ...prev, message: e.target.value }))} 
            placeholder="What's the main message you want to convey?" 
          />
        </div>
      </section>
      <section>
        <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
          <Palette size={20} className="text-primary-600"/>
          Visual & Audio
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField 
              label="Visual Style" 
              id="visualStyle" 
              value={videoForm.visualStyle} 
              onChange={(e) => setVideoForm(prev => ({ ...prev, visualStyle: e.target.value }))}
            >
              <option value="modern">Modern & Clean</option>
              <option value="scientific">Scientific & Technical</option>
              <option value="industrial">Industrial & Practical</option>
            </SelectField>
            <SelectField 
              label="Voice Type" 
              id="voiceType" 
              value={videoForm.voiceType} 
              onChange={(e) => setVideoForm(prev => ({ ...prev, voiceType: e.target.value }))}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="authoritative">Authoritative</option>
            </SelectField>
          </div>
          <div>
            <label htmlFor="visualElements" className="block font-semibold mb-1.5 text-gray-700">Visual Elements</label>
            <TagInput 
              id="visualElements" 
              tags={videoForm.visualElements} 
              onTagsChange={(tags) => setVideoForm(prev => ({ ...prev, visualElements: tags }))} 
              placeholder="Add visual elements..." 
            />
          </div>
        </div>
      </section>
    </div>
  );

  const renderSafetyForm = () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
          <ShieldAlert size={20} className="text-primary-600" />
          Safety Parameters
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField 
              label="Safety Level" 
              id="safetyLevel" 
              value={safetyForm.safetyLevel} 
              onChange={(e) => setSafetyForm(prev => ({ ...prev, safetyLevel: e.target.value }))}
            >
              <option value="basic">Basic</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </SelectField>
            <SelectField 
              label="Work Environment" 
              id="workEnvironment" 
              value={safetyForm.workEnvironment} 
              onChange={(e) => setSafetyForm(prev => ({ ...prev, workEnvironment: e.target.value }))}
            >
              <option value="research-lab">Research Lab</option>
              <option value="production-facility">Production Facility</option>
              <option value="quality-control">Quality Control</option>
            </SelectField>
          </div>
          <div>
            <label htmlFor="hazardCategories" className="block font-semibold mb-1.5 text-gray-700">Hazard Categories</label>
            <TagInput 
              id="hazardCategories" 
              tags={safetyForm.hazardCategories} 
              onTagsChange={(tags) => setSafetyForm(prev => ({ ...prev, hazardCategories: tags }))} 
              placeholder="Add hazard types..." 
            />
          </div>
          <TextAreaField 
            label="Special Considerations" 
            id="considerations" 
            value={safetyForm.considerations} 
            onChange={(e) => setSafetyForm(prev => ({ ...prev, considerations: e.target.value }))} 
            placeholder="Any specific safety considerations..." 
          />
        </div>
      </section>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
      <header className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent mb-3">
          AI Content Factory
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Craft high-quality chemical content with specialized AI agents and RAG-powered insights.
        </p>
      </header>

      <div className="flex justify-center mb-8">
        <div className="flex bg-white rounded-xl p-1.5 shadow-md border border-gray-200">
          {([
            {id: 'blog' as TabType, label: 'Blog Post', icon: FileText},
            {id: 'video' as TabType, label: 'Video Script', icon: Video},
            {id: 'safety' as TabType, label: 'Safety Guide', icon: ShieldAlert}
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-primary-500 to-purple-500 text-white transform shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-primary-600'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 md:p-8 shadow-lg border border-gray-200">
          {activeTab === 'blog' && renderBlogForm()}
          {activeTab === 'video' && renderVideoForm()}
          {activeTab === 'safety' && renderSafetyForm()}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
              <Brain size={20} className="text-primary-600" />
              {activeTab === 'video' ? 'Video Persona' : 'AI Agent'}
            </h3>
            {activeTab === 'blog' && (
              <AgentSelector 
                agents={blogAgents} 
                selectedAgent={blogForm.selectedAgent} 
                onAgentChange={(agent) => setBlogForm(prev => ({ ...prev, selectedAgent: agent }))} 
              />
            )}
            {activeTab === 'video' && (
              <AgentSelector 
                agents={videoAgents} 
                selectedAgent={videoForm.selectedAgent} 
                onAgentChange={(agent) => setVideoForm(prev => ({ ...prev, selectedAgent: agent }))} 
              />
            )}
            {activeTab === 'safety' && (
              <div className="flex items-center gap-4 p-4 border-2 rounded-lg border-primary-600 bg-primary-50 text-primary-700">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary-100 text-primary-600">
                  <Shield size={20} />
                </div>
                <div>
                  <h4 className="font-semibold">Safety Specialist AI</h4>
                  <p className="text-sm opacity-80">Focused on accuracy and compliance.</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
              <Activity size={20} className="text-primary-600"/>
              Generation Control
            </h3>
            {getStatusIndicator()}
            <div className="w-full h-2 bg-gray-200 rounded-full mt-3 mb-4 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generationStatus === 'processing'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-primary-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-xl hover:from-primary-500 hover:to-purple-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {generationStatus === 'processing' ? (
                <>
                  <Loader size={20} className="animate-spin" />
                  Generating...
                </>
              ) : generationStatus === 'complete' ? (
                <>
                  <CheckCircle size={20} />
                  Generated!
                </>
              ) : (
                <>
                  <Play size={20} />
                  Generate Content
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showResults && (
        <div className="mt-8 bg-white rounded-xl p-6 md:p-8 shadow-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle size={24} className={generationStatus === 'error' ? 'text-red-500' : 'text-green-500'} />
              {generationStatus === 'error' ? 'Generation Error' : 'Generated Content'}
            </h3>
            {generationStatus !== 'error' && (
                <div className="flex gap-2">
                    <button className="btn-outline btn-sm"><Edit size={16}/> Edit</button>
                    <button className="btn-outline btn-sm"><Copy size={16}/> Copy</button>
                    <button className="btn-primary btn-sm"><Send size={16}/> Publish</button>
                </div>
            )}
          </div>
          <div className="bg-gray-50 rounded-lg p-6 max-h-[500px] overflow-y-auto">
            {generationStatus === 'error' ? (
                <pre className="text-red-600 whitespace-pre-wrap">Error: {generatedContentPreview?.error || 'An unknown error occurred.'}</pre>
            ) : (
                <pre className="text-sm text-gray-700 whitespace-pre-wrap">{JSON.stringify(generatedContentPreview, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .btn-sm { padding: 0.5rem 1rem; font-size: 0.875rem; }
        .btn-outline { 
          border: 1px solid #d1d5db; 
          color: #6b7280; 
          background-color: white; 
          display: inline-flex; 
          align-items: center; 
          gap: 0.5rem; 
          border-radius: 0.5rem; 
          transition: all 0.2s;
        }
        .btn-outline:hover { 
          background-color: #f9fafb; 
          border-color: #9ca3af; 
          color: #374151;
        }
        .btn-primary { 
          background: linear-gradient(to right, #2563eb, #7c3aed);
          color: white; 
          display: inline-flex; 
          align-items: center; 
          gap: 0.5rem; 
          border-radius: 0.5rem; 
          border: none;
          transition: all 0.2s;
        }
        .btn-primary:hover { 
          background: linear-gradient(to right, #1d4ed8, #6d28d9);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
      `}</style>
    </div>
  );
};

export default ContentGeneratorPage; 