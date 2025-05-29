import Link from 'next/link';
import { FileText, BarChart3, Database, Settings } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to ChemFlow Marketing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered chemical marketing automation system with integrated content generation, campaign management, and RAG-enhanced insights.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          <Link 
            href="/dashboard" 
            className="group bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="bg-blue-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard</h3>
            <p className="text-gray-600 text-sm">View metrics, pipeline status, and recent activity</p>
          </Link>

          <Link 
            href="/content-generator" 
            className="group bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="bg-emerald-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-600 transition-colors">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Content Generator</h3>
            <p className="text-gray-600 text-sm">Generate blogs, videos, and safety content with AI</p>
          </Link>

          <div className="group bg-white rounded-xl p-6 shadow-sm border border-gray-200 opacity-60">
            <div className="bg-purple-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">RAG System</h3>
            <p className="text-gray-600 text-sm">Document search and knowledge base (Coming Soon)</p>
          </div>

          <div className="group bg-white rounded-xl p-6 shadow-sm border border-gray-200 opacity-60">
            <div className="bg-orange-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Settings</h3>
            <p className="text-gray-600 text-sm">Configure agents and integrations (Coming Soon)</p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Start</h2>
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 max-w-2xl mx-auto">
            <div className="space-y-4 text-left">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🔄 Sync Your Shopify Data</h3>
                <code className="bg-gray-100 px-3 py-1 rounded text-sm">
                  npm run cli sync --entity products --metafields
                </code>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🤖 Generate Content</h3>
                <p className="text-gray-600 text-sm">Visit the Content Generator to create AI-powered marketing materials</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">📊 Monitor Progress</h3>
                <p className="text-gray-600 text-sm">Use the Dashboard to track your content pipeline and metrics</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 