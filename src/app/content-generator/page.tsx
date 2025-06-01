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

interface StoredTopic { 
  id: number; 
  title: string;
}

interface OutlineTask { 
    id: number;
    title: string;
}

interface BlogPostData { 
    id: number;
    title: string;
    slug: string;
    status: 'draft' | 'published' | 'archived';
    content: string;
    metaDescription: string;
    keywords: string[];
    wordCount: number;
}

const ContentGeneratorPage: React.FC = () => {
  const [steps, setSteps] = useState<Record<WorkflowStep, StepState>>({
    topics: { status: 'idle' },
    outline: { status: 'idle' },
    content: { status: 'idle' }
  });
  
  const [selectedTopicTask, setSelectedTopicTask] = useState<StoredTopic | null>(null);
  const [generatedOutlineTask, setGeneratedOutlineTask] = useState<OutlineTask | null>(null);

  const updateStep = (step: WorkflowStep, updates: Partial<StepState>) => {
    setSteps(prev => ({
      ...prev,
      [step]: { ...prev[step], ...updates, message: updates.message || prev[step].message }
    }));
  };

  const generateTopics = async () => {
    updateStep('topics', { status: 'processing', message: 'Fetching topic ideas from pipeline...' });
    setGeneratedOutlineTask(null);
    updateStep('outline', { status: 'idle', data: null, message: '' });
    updateStep('content', { status: 'idle', data: null, message: '' });
    
    try {
      const storedTopics = await fetchStoredTopics();
      
      updateStep('topics', { 
        status: 'complete', 
        data: { storedTopics: storedTopics },
        message: storedTopics.length > 0 ? `Found ${storedTopics.length} blog ideas. Select one to generate an outline.` : "No pending blog ideas found in the pipeline. The cron job might need to run or topics need approval."
      });
    } catch (error: any) {
      updateStep('topics', { 
        status: 'error', 
        message: `Error fetching topics: ${error.message}` 
      });
    }
  };

  const generateOutline = async () => {
    if (!selectedTopicTask) {
        alert("Please select a topic idea first.");
        return;
    }
    
    updateStep('outline', { status: 'processing', message: `Creating outline for: "${selectedTopicTask.title}"...` });
    setGeneratedOutlineTask(null);
    updateStep('content', { status: 'idle', data: null, message: '' });

    try {
      const response = await fetch('/api/generate/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineTaskId: selectedTopicTask.id }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details || 'Failed to generate outline');
      }

      if (data.outlineTask) {
        setGeneratedOutlineTask(data.outlineTask as OutlineTask);
        updateStep('outline', { 
          status: 'complete',
          message: `Outline "${data.outlineTask.title}" generated! Ready to write content.` 
        });
      } else {
        throw new Error('Outline generation API call succeeded but no outline task returned.');
      }
    } catch (error: any) {
      updateStep('outline', { 
        status: 'error', 
        message: `Error generating outline: ${error.message}` 
      });
    }
  };

  const writeContent = async () => {
    if (!generatedOutlineTask) {
        alert("No outline has been generated or selected yet.");
        return;
    }
    
    updateStep('content', { status: 'processing', message: `AI agents writing content for: "${generatedOutlineTask.title.replace('Outline: ','')}"...` });
    
    try {
      const response = await fetch('/api/generate/full-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlineTaskId: generatedOutlineTask.id }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details || 'Failed to write content');
      }

      if (data.blogPost) {
        updateStep('content', { 
          status: 'complete',
          data: { articles: [data.blogPost as BlogPostData] },
          message: `Content written for "${data.blogPost.title}"! View in Blog Manager or Preview.`
        });
      } else {
        throw new Error("Content writing API call succeeded but no blog post returned.");
      }
    } catch (error: any) {
      updateStep('content', { 
        status: 'error', 
        message: `Error writing content: ${error.message}` 
      });
    }
  };

  const toggleTopicSelection = (topicTask: StoredTopic) => {
    if (selectedTopicTask?.id === topicTask.id) {
      setSelectedTopicTask(null);
    } else {
      setSelectedTopicTask(topicTask);
    }
    setGeneratedOutlineTask(null);
    updateStep('outline', { status: 'idle', data: null, message: '' });
    updateStep('content', { status: 'idle', data: null, message: '' });
  };

  const fetchStoredTopics = async (): Promise<StoredTopic[]> => {
    try {
      const response = await fetch('/api/content-pipeline/topics');
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.topics)) {
            return data.topics.filter((t: any) => typeof t.id === 'number' && typeof t.title === 'string');
        }
        console.warn("Fetched topics in unexpected format:", data);
        return [];
      }
       const errorData = await response.json();
       throw new Error(errorData.error || `Failed to fetch topics (status ${response.status})`);
    } catch (error) {
      console.error('Failed to fetch stored topics:', error);
      throw error;
    }
  };

  const availableTopics: StoredTopic[] = steps.topics.data?.storedTopics || [];

  const StepButton = ({ 
    step, 
    icon, 
    title, 
    description, 
    onClick, 
    disabledCondition 
  }: {
    step: WorkflowStep;
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    disabledCondition: boolean; 
  }) => {
    const stepState = steps[step];
    const isDisabled = disabledCondition || stepState.status === 'processing';
    
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
            disabled={isDisabled}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : stepState.status === 'complete'
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {stepState.status === 'processing' ? 'Processing...' :
             stepState.status === 'complete' ? (step === 'topics' ? 'Ideas Loaded' : (step === 'outline' ? 'Outline Ready' : 'Content Written')) :
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
            title="1. Load Topic Ideas"
            description="Fetch pending 'blog_idea' tasks from the content pipeline."
            onClick={generateTopics}
            disabledCondition={steps.topics.status === 'processing'}
          />

          {/* Topic Selection Interface */}
          {steps.topics.status === 'complete' && availableTopics.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📋 Select Topic Idea ({selectedTopicTask ? 1 : 0} selected)
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose one topic idea to generate an outline for:
              </p>
              <div className="grid gap-3 max-h-60 overflow-y-auto">
                {availableTopics.map((topicTask) => (
                  <div
                    key={topicTask.id}
                    onClick={() => toggleTopicSelection(topicTask)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedTopicTask?.id === topicTask.id
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedTopicTask?.id === topicTask.id
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {selectedTopicTask?.id === topicTask.id && (
                          <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                        )}
                      </div>
                      <span className="font-medium">{topicTask.title} (Task ID: {topicTask.id})</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedTopicTask && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    ✅ Topic "{selectedTopicTask.title}" selected. Click "Generate Outline" to continue.
                  </p>
                </div>
              )}
            </div>
          )}
           {steps.topics.status === 'complete' && availableTopics.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm text-center">
                    <p className="text-gray-600">No pending topic ideas found to generate outlines for. The cron job might need to run or existing ideas might already have outlines.</p>
                </div>
            )}

          <div className="flex justify-center">
            <ChevronRight className="text-gray-400" size={24} />
          </div>

          <StepButton
            step="outline"
            icon={<Brain size={20} />}
            title="2. Generate Outline"
            description="Create detailed article structures and key points"
            onClick={generateOutline}
            disabledCondition={!selectedTopicTask || steps.outline.status === 'processing'}
          />

          {steps.outline.status === 'complete' && generatedOutlineTask && (
             <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Outline Generated:</h3>
                <p className="text-md text-gray-700">{generatedOutlineTask.title}</p>
                <p className="text-sm text-gray-500">Task ID: {generatedOutlineTask.id}</p>
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
            disabledCondition={!generatedOutlineTask || steps.content.status === 'processing'}
          />
        </div>

        {/* Results Section */}
        {steps.content.status === 'complete' && steps.content.data?.articles?.length > 0 && (
          <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="text-green-600" size={24} />
              <h2 className="text-xl font-semibold text-gray-900">Content Ready!</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Blog article "{steps.content.data.articles[0].title}" (ID: {steps.content.data.articles[0].id}) has been generated. You can view it in the Blog Manager.
            </p>
            <div className="flex gap-4">
              <a
                href={`/dashboard/content/blogs/${steps.content.data.articles[0].id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit size={16} />
                Edit in Blog Manager
              </a>
              <a
                href={`/blog/${steps.content.data.articles[0].slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FileText size={16} />
                Preview Blog Post
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentGeneratorPage; 