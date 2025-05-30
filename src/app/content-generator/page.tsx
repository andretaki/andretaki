'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Brain, Edit, CheckCircle, Loader, 
  ChevronRight, Lightbulb, Zap, PenTool 
} from 'lucide-react';

type WorkflowStep = 'topics' | 'outline' | 'content';
type StepStatus = 'idle' | 'processing' | 'complete' | 'error';

interface StepState {
  status: StepStatus;
  data?: any;
  message?: string;
}

const ContentGeneratorPage: React.FC = () => {
  const [steps, setSteps] = useState<Record<WorkflowStep, StepState>>({
    topics: { status: 'idle' },
    outline: { status: 'idle' },
    content: { status: 'idle' }
  });
  
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const updateStep = (step: WorkflowStep, updates: Partial<StepState>) => {
    setSteps(prev => ({
      ...prev,
      [step]: { ...prev[step], ...updates }
    }));
  };

  const generateTopics = async () => {
    updateStep('topics', { status: 'processing', message: 'Analyzing your chemical products...' });
    
    try {
      const response = await fetch('/api/generate/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusType: 'chemical',
          focusValue: 'Vinegar',  // Use actual product from your database
          targetAudience: 'Laboratory Technicians'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate topics');
      }

      const data = await response.json();
      console.log('API Response:', data);
      
      // After generation, immediately fetch the stored topics
      const storedTopics = await fetchStoredTopics();
      console.log('Fetched stored topics:', storedTopics);
      
      updateStep('topics', { 
        status: 'complete', 
        data: { 
          ...data, 
          storedTopics: storedTopics 
        },
        message: `Generated ${storedTopics.length} topics - Select which ones to continue with!` 
      });
    } catch (error: any) {
      updateStep('topics', { 
        status: 'error', 
        message: `Error: ${error.message}` 
      });
    }
  };

  const generateOutline = async () => {
    if (steps.topics.status !== 'complete' || selectedTopics.length === 0) return;
    
    updateStep('outline', { status: 'processing', message: `Creating outlines for ${selectedTopics.length} selected topics...` });
    
    try {
      // Simulate outline generation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      updateStep('outline', { 
        status: 'complete',
        data: { outlines: selectedTopics.map(topic => `Outline for: ${topic}`) },
        message: `Created outlines for ${selectedTopics.length} topics!` 
      });
    } catch (error: any) {
      updateStep('outline', { 
        status: 'error', 
        message: `Error: ${error.message}` 
      });
    }
  };

  const writeContent = async () => {
    if (steps.outline.status !== 'complete') return;
    
    updateStep('content', { status: 'processing', message: 'AI agents writing content...' });
    
    try {
      // Simulate content writing - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      updateStep('content', { 
        status: 'complete',
        data: { articles: selectedTopics.map(topic => `Article: ${topic}`) },
        message: 'Content written and ready to publish!' 
      });
    } catch (error: any) {
      updateStep('content', { 
        status: 'error', 
        message: `Error: ${error.message}` 
      });
    }
  };

  const toggleTopicSelection = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  // Parse topics from actual API response
  const getTopicsFromData = () => {
    if (!steps.topics.data) return [];
    
    console.log('Topics data:', steps.topics.data); // Debug log
    
    // If we have stored topics from the database, use those
    if (steps.topics.data.storedTopics && Array.isArray(steps.topics.data.storedTopics)) {
      return steps.topics.data.storedTopics;
    }
    
    // If API returned topics directly (fallback)
    if (Array.isArray(steps.topics.data)) {
      return steps.topics.data.map((topic: any) => 
        typeof topic === 'string' ? topic : topic.title || topic.suggested_title || 'Untitled Topic'
      );
    }
    
    return [];
  };

  // Add function to fetch topics from database
  const fetchStoredTopics = async () => {
    try {
      const response = await fetch('/api/content-pipeline/topics');
      if (response.ok) {
        const data = await response.json();
        return data.topics || [];
      }
    } catch (error) {
      console.error('Failed to fetch stored topics:', error);
    }
    return [];
  };

  const availableTopics = steps.topics.status === 'complete' ? getTopicsFromData() : [];

  const StepButton = ({ 
    step, 
    icon, 
    title, 
    description, 
    onClick, 
    disabled 
  }: {
    step: WorkflowStep;
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    disabled: boolean;
  }) => {
    const stepState = steps[step];
    
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              stepState.status === 'complete' ? 'bg-green-100 text-green-600' :
              stepState.status === 'processing' ? 'bg-blue-100 text-blue-600' :
              stepState.status === 'error' ? 'bg-red-100 text-red-600' :
              'bg-gray-100 text-gray-600'
            }`}>
              {stepState.status === 'processing' ? <Loader className="animate-spin" size={20} /> :
               stepState.status === 'complete' ? <CheckCircle size={20} /> :
               icon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
          </div>
          
          <button
            onClick={onClick}
            disabled={disabled || stepState.status === 'processing'}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              disabled || stepState.status === 'processing'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : stepState.status === 'complete'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {stepState.status === 'processing' ? 'Processing...' :
             stepState.status === 'complete' ? 'Regenerate' :
             'Generate'}
          </button>
        </div>
        
        {stepState.message && (
          <div className={`p-3 rounded-lg text-sm ${
            stepState.status === 'error' ? 'bg-red-50 text-red-700' :
            stepState.status === 'complete' ? 'bg-green-50 text-green-700' :
            'bg-blue-50 text-blue-700'
          }`}>
            {stepState.message}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Content Factory</h1>
          <p className="text-gray-600">Automated content generation for your chemical products</p>
        </div>

        {/* Workflow Steps */}
        <div className="space-y-6">
          <StepButton
            step="topics"
            icon={<Lightbulb size={20} />}
            title="1. Generate Topics"
            description="AI analyzes your Shopify products and generates SEO-worthy blog topics"
            onClick={generateTopics}
            disabled={false}
          />

          <div className="flex justify-center">
            <ChevronRight className="text-gray-400" size={24} />
          </div>

          <StepButton
            step="outline"
            icon={<Brain size={20} />}
            title="2. Generate Outline"
            description="Create detailed article structures and key points"
            onClick={generateOutline}
            disabled={steps.topics.status !== 'complete' || selectedTopics.length === 0}
          />

          {/* Topic Selection Interface */}
          {steps.topics.status === 'complete' && availableTopics.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📋 Select Topics ({selectedTopics.length} selected)
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose 5-10 topics you'd like to create outlines and content for:
              </p>
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {availableTopics.map((topic, index) => (
                  <div
                    key={index}
                    onClick={() => toggleTopicSelection(topic)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedTopics.includes(topic)
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedTopics.includes(topic)
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {selectedTopics.includes(topic) && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="font-medium">{topic}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedTopics.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    ✅ {selectedTopics.length} topics selected. Click "Generate Outline" to continue!
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-center">
            <ChevronRight className="text-gray-400" size={24} />
          </div>

          <StepButton
            step="content"
            icon={<PenTool size={20} />}
            title="3. Write Content"
            description="AI agents collaborate to write publish-ready blog articles"
            onClick={writeContent}
            disabled={steps.outline.status !== 'complete'}
          />
        </div>

        {/* Results Section */}
        {steps.content.status === 'complete' && (
          <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="text-green-600" size={24} />
              <h2 className="text-xl font-semibold text-gray-900">Content Ready!</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Your blog articles have been generated and are ready to publish to your Shopify blog.
            </p>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                View Articles
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                Publish to Shopify
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentGeneratorPage; 