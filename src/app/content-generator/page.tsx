'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Brain, Edit, CheckCircle, Loader, 
  ChevronRight, Lightbulb, Zap, PenTool 
} from 'lucide-react';
import Link from 'next/link';

type WorkflowStep = 'topics' | 'outline' | 'content';
type StepStatus = 'idle' | 'processing' | 'complete' | 'error';

interface StepState {
  status: StepStatus;
  data?: any; 
  message?: string;
}

// Represents a 'blog_idea' task from the content_pipeline
interface StoredTopic { 
  id: number; // This is content_pipeline.id for task_type = 'blog_idea'
  title: string;
}

// Represents the 'blog_outline' task object from the content_pipeline
interface OutlineTask { 
    id: number; // This is the content_pipeline.id for the 'blog_outline' task
    title: string;
}

// Represents the blog post object returned by the API after generation
interface GeneratedBlogPostData { 
    id: number;
    title: string;
    slug: string; // Useful for preview links
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
  const [generatedBlogPost, setGeneratedBlogPost] = useState<GeneratedBlogPostData | null>(null);

  const updateStep = (step: WorkflowStep, updates: Partial<StepState>) => {
    setSteps(prev => ({
      ...prev,
      [step]: { ...prev[step], ...updates, message: updates.message || prev[step].message }
    }));
  };
  
  // Fetch 'blog_idea' tasks from the pipeline
  const fetchTopicIdeas = async () => {
    updateStep('topics', { status: 'processing', message: 'Fetching topic ideas from pipeline...' });
    setSelectedTopicTask(null); // Reset selections
    setGeneratedOutlineTask(null);
    setGeneratedBlogPost(null);
    updateStep('outline', { status: 'idle', data: null, message: '' });
    updateStep('content', { status: 'idle', data: null, message: '' });
    
    try {
      const response = await fetch('/api/content-pipeline/topics'); // This API returns {id, title}[]
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch topic ideas (status ${response.status})`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.topics)) {
        const validTopics: StoredTopic[] = data.topics.filter((t: any) => typeof t.id === 'number' && typeof t.title === 'string');
        updateStep('topics', { 
          status: 'complete', 
          data: { storedTopics: validTopics },
          message: validTopics.length > 0 ? `Found ${validTopics.length} blog ideas. Select one to generate an outline.` : "No pending blog ideas found. The cron job might need to run or topics need approval."
        });
      } else {
        throw new Error(data.error || 'Fetched topics in unexpected format.');
      }
    } catch (error: any) {
      updateStep('topics', { 
        status: 'error', 
        message: `Error fetching topic ideas: ${error.message}` 
      });
    }
  };

  useEffect(() => {
    fetchTopicIdeas(); // Fetch topics on initial load
  }, []);

  const handleGenerateOutline = async () => {
    if (!selectedTopicTask) {
        alert("Please select a topic idea first.");
        return;
    }
    
    updateStep('outline', { status: 'processing', message: `Creating outline for: "${selectedTopicTask.title}"...` });
    setGeneratedOutlineTask(null); // Reset previous outline
    setGeneratedBlogPost(null);
    updateStep('content', { status: 'idle', data: null, message: '' }); // Reset content step

    try {
      const response = await fetch('/api/generate/outline', { // Calls POST /api/generate/outline
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
        throw new Error(data.message || 'Outline generation API call succeeded but no outline task returned.');
      }
    } catch (error: any) {
      updateStep('outline', { 
        status: 'error', 
        message: `Error generating outline: ${error.message}` 
      });
    }
  };

  const handleWriteContent = async () => {
    if (!generatedOutlineTask) {
        alert("No outline has been generated or selected yet.");
        return;
    }
    
    updateStep('content', { status: 'processing', message: `AI agents writing content for: "${generatedOutlineTask.title.replace('Outline: ','')}"...` });
    setGeneratedBlogPost(null);
    
    try {
      const response = await fetch('/api/generate/full-blog', { // Calls POST /api/generate/full-blog
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlineTaskId: generatedOutlineTask.id }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details || 'Failed to write content');
      }

      if (data.blogPost) {
        setGeneratedBlogPost(data.blogPost as GeneratedBlogPostData);
        updateStep('content', { 
          status: 'complete',
          message: `Content written for "${data.blogPost.title}"! View in Blog Manager or Preview.`
        });
      } else {
        throw new Error(data.message || "Content writing API call succeeded but no blog post returned.");
      }
    } catch (error: any) {
      updateStep('content', { 
        status: 'error', 
        message: `Error writing content: ${error.message}` 
      });
    }
  };

  const handleToggleTopicSelection = (topicTask: StoredTopic) => {
    if (steps.topics.status === 'processing' || steps.outline.status === 'processing' || steps.content.status === 'processing') return;

    if (selectedTopicTask?.id === topicTask.id) {
      setSelectedTopicTask(null); 
    } else {
      setSelectedTopicTask(topicTask); 
    }
    setGeneratedOutlineTask(null); 
    setGeneratedBlogPost(null);
    updateStep('outline', { status: 'idle', data: null, message: '' });
    updateStep('content', { status: 'idle', data: null, message: '' });
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
    
    let buttonText = 'Generate';
    if (stepState.status === 'processing') buttonText = 'Processing...';
    else if (stepState.status === 'complete') {
        if (step === 'topics') buttonText = 'Ideas Loaded';
        else if (step === 'outline') buttonText = 'Outline Ready';
        else if (step === 'content') buttonText = 'Content Written';
    } else if (step === 'topics' && stepState.status === 'idle') {
        buttonText = 'Load Ideas';
    }
    
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
            {buttonText}
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
          <p className="text-gray-600">Generate blog content step-by-step from pipeline ideas.</p>
        </div>

        {/* Workflow Steps */}
        <div className="space-y-6">
          <StepButton
            step="topics"
            icon={<Lightbulb size={20} />}
            title="1. Load Topic Ideas"
            description="Fetch pending 'blog_idea' tasks from the content pipeline."
            onClick={fetchTopicIdeas}
            disabledCondition={steps.topics.status === 'processing'}
          />

          {steps.topics.status === 'complete' && (
            availableTopics.length > 0 ? (
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
                        onClick={() => handleToggleTopicSelection(topicTask)}
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
            ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm text-center">
                    <p className="text-gray-600">No pending topic ideas found to generate outlines for. The cron job might need to run, or existing ideas might already have outlines/content.</p>
                </div>
            )
          )}
          
          <div className="flex justify-center">
            <ChevronRight className="text-gray-400" size={24} />
          </div>

          <StepButton
            step="outline"
            icon={<Brain size={20} />}
            title="2. Generate Outline"
            description="Create detailed article structures and key points"
            onClick={handleGenerateOutline}
            disabledCondition={!selectedTopicTask || steps.topics.status !== 'complete' || steps.outline.status === 'processing'}
          />

          {steps.outline.status === 'complete' && generatedOutlineTask && (
             <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Outline Generated:</h3>
                <p className="text-md text-gray-700">{generatedOutlineTask.title}</p>
                <p className="text-sm text-gray-500">Outline Task ID: {generatedOutlineTask.id}</p>
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
            onClick={handleWriteContent}
            disabledCondition={!generatedOutlineTask || steps.outline.status !== 'complete' || steps.content.status === 'processing'}
          />
        </div>

        {/* Results Section */}
        {steps.content.status === 'complete' && generatedBlogPost && (
          <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="text-green-600" size={24} />
              <h2 className="text-xl font-semibold text-gray-900">Content Ready!</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Blog article "{generatedBlogPost.title}" (ID: {generatedBlogPost.id}) has been generated as a draft.
            </p>
            <div className="flex gap-4">
              <Link
                href={`/dashboard/content?view=edit&id=${generatedBlogPost.id}&mode=edit`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit size={16} />
                Edit in Blog Manager
              </Link>
              <a
                href={`/blog/${generatedBlogPost.slug}`}
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