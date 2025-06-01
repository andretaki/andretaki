'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Product, VideoPersona, BlogPost, Video, VideoSegment } from '../../../../lib/db/schema';
import { toast } from 'sonner';
import { Loader2, CheckCircle, AlertTriangle, Zap, ListChecks, Edit3 } from 'lucide-react';

// Define types for strategy and segment script data for frontend state
interface VideoStrategyData {
    videoId: number;
    title: string;
    description: string;
    keywords: string[];
    segmentsCreated: number;
    suggestedAdKeywords?: string[];
    suggestedTargetAudienceDescriptors?: string[];
}

// Use the VideoSegment type directly from schema
type FrontendVideoSegment = VideoSegment;

export default function VideoGenerator() {
    const [products, setProducts] = useState<Pick<Product, 'id' | 'title'>[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<number | ''>('');

    const [personas, setPersonas] = useState<Pick<VideoPersona, 'id' | 'name' | 'description'>[]>([]);
    const [selectedPersonaId, setSelectedPersonaId] = useState<number | ''>('');

    const [blogPostsList, setBlogPostsList] = useState<Pick<BlogPost, 'id' | 'title'>[]>([]);
    const [selectedBlogId, setSelectedBlogId] = useState<number | ''>('');
    
    const [platformAndGoal, setPlatformAndGoal] = useState<string>("youtube_educational_product_deep_dive");
    const [keyCustomThemes, setKeyCustomThemes] = useState<string>("");

    const [isLoadingStrategy, setIsLoadingStrategy] = useState(false);
    const [isLoadingSegments, setIsLoadingSegments] = useState(false);
    const [isLoadingScript, setIsLoadingScript] = useState<Record<number, boolean>>({}); // segmentId -> boolean
    
    const [generatedStrategy, setGeneratedStrategy] = useState<VideoStrategyData | null>(null);
    const [currentVideoSegments, setCurrentVideoSegments] = useState<FrontendVideoSegment[]>([]);
    
    // Fetch initial data for dropdowns
    useEffect(() => {
        const fetchData = async () => {
            try {
                const productsRes = await fetch('/api/products/available');
                if (productsRes.ok) {
                    const productsData = await productsRes.json();
                    setProducts(productsData.products || []);
                } else { toast.error("Failed to load products."); }

                const personasRes = await fetch('/api/video-personas');
                if (personasRes.ok) {
                    const personasData = await personasRes.json();
                    setPersonas(personasData.personas || []);
                } else { toast.error("Failed to load video personas."); }
                
                const blogPostsRes = await fetch('/api/blogs?limit=100&status=published_on_shopify&status=published');
                if (blogPostsRes.ok) {
                    const blogPostsData = await blogPostsRes.json();
                    setBlogPostsList(blogPostsData.blogs || []);
                } else { toast.error("Failed to load blog posts."); }

            } catch (error) {
                toast.error("Error fetching initial data for Video Generator.");
                console.error("Data fetching error:", error);
            }
        };
        fetchData();
    }, []);

    const fetchSegmentsForVideo = useCallback(async (videoId: number) => {
        setIsLoadingSegments(true);
        try {
            const response = await fetch(`/api/videos/${videoId}/segments`);
            if (response.ok) {
                const segments = await response.json();
                setCurrentVideoSegments(segments || []);
            } else {
                toast.error("Failed to fetch segments: Server error.");
                setCurrentVideoSegments([]);
            }
        } catch (error) {
            toast.error("An error occurred while fetching segments.");
            setCurrentVideoSegments([]);
            console.error("Fetch segments error:", error);
        } finally {
            setIsLoadingSegments(false);
        }
    }, []);

    const handleGenerateStrategy = async () => {
        if (!selectedProductId || !selectedPersonaId || !platformAndGoal) {
            toast.error("Please select a Product, Persona, and Platform & Goal.");
            return;
        }
        setIsLoadingStrategy(true);
        setGeneratedStrategy(null);
        setCurrentVideoSegments([]);
        
        const payload: any = {
            productId: Number(selectedProductId),
            platformAndGoal: platformAndGoal,
            personaId: Number(selectedPersonaId),
        };
        if (selectedBlogId) payload.optionalBlogId = Number(selectedBlogId);
        if (keyCustomThemes.trim()) payload.keyCustomThemes = keyCustomThemes.split(',').map(theme => theme.trim());

        try {
            const response = await fetch('/api/generate/video-strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (response.ok && data.success) {
                toast.success("Video strategy generated successfully!");
                setGeneratedStrategy(data);
                if (data.videoId) {
                    await fetchSegmentsForVideo(data.videoId);
                }
            } else {
                toast.error(data.error || data.details?.error || "Failed to generate video strategy.");
            }
        } catch (error) {
            toast.error("An error occurred while generating strategy.");
            console.error("Strategy generation error:", error);
        } finally {
            setIsLoadingStrategy(false);
        }
    };

    const handleGenerateScriptForSegment = async (segmentId: number) => {
        setIsLoadingScript(prev => ({ ...prev, [segmentId]: true }));
        try {
            const response = await fetch('/api/generate/video-segment-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoSegmentId: segmentId }),
            });
            const data = await response.json();
            if (response.ok && data.success && data.updatedSegment) {
                toast.success(`Script generated for segment ${segmentId}!`);
                setCurrentVideoSegments(prevSegments => 
                    prevSegments.map(seg => seg.id === segmentId ? data.updatedSegment : seg)
                );
            } else {
                toast.error(data.error || data.details?.error || `Failed to generate script for segment ${segmentId}.`);
                setCurrentVideoSegments(prevSegments => 
                    prevSegments.map(seg => seg.id === segmentId ? {...seg, status: 'error_scripting', error_message: data.error || 'Unknown scripting error'} : seg)
                );
            }
        } catch (error) {
            toast.error(`An error occurred while generating script for segment ${segmentId}.`);
            console.error(`Script generation error for segment ${segmentId}:`, error);
            setCurrentVideoSegments(prevSegments => 
                prevSegments.map(seg => seg.id === segmentId ? {...seg, status: 'error_scripting', error_message: 'Network or API error'} : seg)
            );
        } finally {
            setIsLoadingScript(prev => ({ ...prev, [segmentId]: false }));
        }
    };
    
    const platformGoalOptions = [
        { value: "youtube_educational_product_deep_dive", label: "YouTube - Educational Deep Dive" },
        { value: "youtube_short_product_teaser", label: "YouTube Short - Product Teaser" },
        { value: "tiktok_engagement_safety_tip", label: "TikTok - Engagement/Safety Tip" },
        { value: "tiktok_quick_product_showcase", label: "TikTok - Quick Product Showcase" },
        { value: "linkedin_leadgen_application_showcase", label: "LinkedIn - Lead Gen Application Showcase" },
        { value: "instagram_reel_brand_awareness", label: "Instagram Reel - Brand Awareness" },
    ];

    const getStatusChip = (status: string) => {
        if (status === 'script_completed') return <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">Script Ready</span>;
        if (status === 'pending') return <span className="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">Pending Script</span>;
        if (status === 'scripting_in_progress') return <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">Scripting...</span>;
        if (status.includes('error')) return <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">Error</span>;
        return <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">{status}</span>;
    };

    return (
        <div className="space-y-6 p-4 sm:p-6 bg-slate-50 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-slate-800 border-b pb-3">Video Script Generator</h2>

            {/* Inputs UI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <label htmlFor="product" className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                    <select id="product" value={selectedProductId} onChange={e => setSelectedProductId(Number(e.target.value))}
                        className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                        <option value="">Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                </div>

                <div>
                    <label htmlFor="platformGoal" className="block text-sm font-medium text-slate-700 mb-1">Platform & Goal</label>
                    <select id="platformGoal" value={platformAndGoal} onChange={e => setPlatformAndGoal(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                        {platformGoalOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                
                <div>
                    <label htmlFor="persona" className="block text-sm font-medium text-slate-700 mb-1">Video Persona</label>
                    <select id="persona" value={selectedPersonaId} onChange={e => setSelectedPersonaId(Number(e.target.value))}
                        className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                        <option value="">Select Persona</option>
                        {personas.map(p => <option key={p.id} value={p.id}>{p.name} - {p.description.substring(0,40)}...</option>)}
                    </select>
                </div>

                <div>
                    <label htmlFor="blogPost" className="block text-sm font-medium text-slate-700 mb-1">Optional: Blog Post Source</label>
                    <select id="blogPost" value={selectedBlogId} onChange={e => setSelectedBlogId(Number(e.target.value))}
                        className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                        <option value="">None</option>
                        {blogPostsList.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </select>
                </div>

                <div className="md:col-span-2">
                    <label htmlFor="customThemes" className="block text-sm font-medium text-slate-700 mb-1">Key Custom Themes (comma-separated)</label>
                    <textarea id="customThemes" value={keyCustomThemes} onChange={e => setKeyCustomThemes(e.target.value)} rows={3}
                        className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        placeholder="e.g., sustainability, ease of use, cost-effectiveness"
                    />
                </div>
            </div>

            {/* Step 1: Generate Video Strategy */}
            <div className="text-center mt-4">
                <button onClick={handleGenerateStrategy} disabled={isLoadingStrategy || !selectedProductId || !selectedPersonaId}
                    className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center mx-auto">
                    {isLoadingStrategy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
                    {isLoadingStrategy ? 'Generating Strategy...' : 'Generate Video Strategy'}
                </button>
            </div>

            {/* Display Strategy and Segments */}
            {isLoadingSegments && (
                <div className="flex justify-center items-center p-6"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /> <span className="ml-2 text-slate-600">Loading segments...</span></div>
            )}

            {generatedStrategy && !isLoadingSegments && (
                <div className="mt-8 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="border-b border-slate-200 pb-4 mb-4">
                        <h3 className="text-2xl font-semibold text-slate-800 flex items-center"><ListChecks className="mr-3 text-indigo-500 h-7 w-7"/>Generated Video Strategy (ID: {generatedStrategy.videoId})</h3>
                        <p className="mt-1 text-sm text-slate-600"><strong>Title:</strong> {generatedStrategy.title}</p>
                        <p className="mt-1 text-sm text-slate-600"><strong>Description:</strong> {generatedStrategy.description}</p>
                        {generatedStrategy.keywords && generatedStrategy.keywords.length > 0 && (
                             <p className="mt-1 text-sm text-slate-600"><strong>Keywords:</strong> {generatedStrategy.keywords.join(', ')}</p>
                        )}
                        {generatedStrategy.suggestedAdKeywords && generatedStrategy.suggestedAdKeywords.length > 0 && (
                            <p className="mt-1 text-sm text-slate-500"><strong>Ad Keywords:</strong> {generatedStrategy.suggestedAdKeywords.join(', ')}</p>
                        )}
                         {generatedStrategy.suggestedTargetAudienceDescriptors && generatedStrategy.suggestedTargetAudienceDescriptors.length > 0 && (
                            <p className="mt-1 text-sm text-slate-500"><strong>Target Audience:</strong> {generatedStrategy.suggestedTargetAudienceDescriptors.join('; ')}</p>
                        )}
                    </div>
                    
                    <h4 className="text-xl font-medium mt-6 mb-3 text-slate-700">Planned Segments ({currentVideoSegments.length}):</h4>
                    {currentVideoSegments.length === 0 && !isLoadingSegments && (
                        <p className="text-slate-500">No segments found for this strategy yet. This might be an issue if strategy generation reported segments created.</p>
                    )}
                    <ul className="space-y-4">
                        {currentVideoSegments.map(segment => (
                            <li key={segment.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                    <div className="mb-2 sm:mb-0">
                                        <p className="font-semibold text-slate-700">Segment {segment.segment_order}: <span className="font-normal text-indigo-600">{segment.segment_type}</span> ({segment.duration_seconds}s)</p>
                                        {getStatusChip(segment.status!)}
                                    </div>
                                    {(segment.status === 'pending' || segment.status?.includes('error')) && (
                                        <button onClick={() => handleGenerateScriptForSegment(segment.id!)} disabled={isLoadingScript[segment.id!]}
                                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors">
                                            {isLoadingScript[segment.id!] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-2 h-4 w-4" />}
                                            {isLoadingScript[segment.id!] ? 'Generating...' : segment.status?.includes('error') ? 'Retry Script' : 'Generate Script'}
                                        </button>
                                    )}
                                </div>
                                {(segment.status === 'script_completed' && segment.narration_script) && (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                        <p className="text-sm text-slate-600"><strong>Narration:</strong> {segment.narration_script.substring(0, 120)}...</p>
                                        <p className="text-sm text-slate-600 mt-1"><strong>Visual Concept:</strong> {segment.visual_concept_description?.substring(0,120)}...</p>
                                        {/* Future: Button to view/edit full script details in a modal */}
                                    </div>
                                )}
                                 {segment.status?.includes('error') && segment.error_message && (
                                    <p className="text-sm text-red-600 mt-1 flex items-center"><AlertTriangle className="h-4 w-4 mr-1"/> Error: {segment.error_message}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
} 