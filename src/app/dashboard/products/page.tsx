'use client';

import { Package } from 'lucide-react';

export default function ProductsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Products</h1>
        <p className="text-lg text-gray-600">Manage your chemical products catalog</p>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-semibold">Product Catalog</h2>
        </div>
        
        <p className="text-gray-600">Product management features coming soon...</p>
      </div>
    </div>
  );
} 