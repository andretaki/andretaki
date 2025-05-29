'use client';

import { Video } from 'lucide-react';

export default function VideosPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Videos</h1>
        <p className="text-lg text-gray-600">Manage and generate video content</p>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Video className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-semibold">Video Library</h2>
        </div>
        
        <p className="text-gray-600">Video management features coming soon...</p>
      </div>
    </div>
  );
} 