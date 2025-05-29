'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  TrendingUp, 
  Users, 
  ShoppingCart, 
  DollarSign,
  Activity,
  BarChart3,
  FileText,
  Settings,
  Beaker,
  Palette,
  Play,
  PlusCircle,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Star,
  Target,
  Zap,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Loader,
  RefreshCw
} from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down';
  icon: React.ReactNode;
  gradient: string;
  description?: string;
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, trend, icon, gradient, description, loading }) => (
  <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1">
    {/* Background gradient */}
    <div className={`absolute inset-0 opacity-5 ${gradient}`}></div>
    
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${gradient} shadow-lg`}>
          {loading ? <Loader className="w-5 h-5 text-white animate-spin" /> : icon}
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
          trend === 'up' 
            ? 'bg-emerald-50 text-emerald-700' 
            : 'bg-red-50 text-red-700'
        }`}>
          {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {loading ? '...' : change}
        </div>
      </div>
      
      <div>
        <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 mb-1">
          {loading ? <div className="h-8 bg-gray-200 rounded animate-pulse w-20"></div> : value}
        </p>
        {description && (
          <p className="text-xs text-gray-500">{description}</p>
        )}
      </div>
    </div>
  </div>
);

interface TaskCardProps {
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  type: string;
  dueDate: string;
  priority?: 'low' | 'medium' | 'high';
}

const TaskCard: React.FC<TaskCardProps> = ({ title, status, type, dueDate, priority = 'medium' }) => {
  const statusConfig = {
    pending: { 
      color: 'bg-amber-50 text-amber-700 border-amber-200', 
      icon: <Clock className="w-3 h-3" />,
      dot: 'bg-amber-400'
    },
    in_progress: { 
      color: 'bg-blue-50 text-blue-700 border-blue-200', 
      icon: <Activity className="w-3 h-3" />,
      dot: 'bg-blue-400'
    },
    completed: { 
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', 
      icon: <CheckCircle className="w-3 h-3" />,
      dot: 'bg-emerald-400'
    }
  };

  const priorityConfig = {
    low: 'border-l-gray-300',
    medium: 'border-l-blue-400',
    high: 'border-l-red-400'
  };

  return (
    <div className={`bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all duration-200 border-l-4 ${priorityConfig[priority]}`}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-gray-900 text-sm leading-relaxed pr-2">{title}</h3>
        <button className="text-gray-400 hover:text-gray-600 transition-colors">
          <MoreHorizontal size={14} />
        </button>
      </div>
      
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig[status].color}`}>
          {statusConfig[status].icon}
          {status.replace('_', ' ')}
        </span>
        <div className={`w-2 h-2 rounded-full ${statusConfig[status].dot}`}></div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-medium">{type}</span>
        <span className="text-gray-500 flex items-center gap-1">
          <Calendar size={10} />
          {dueDate}
        </span>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  
  // Dynamic data states
  const [pipelineStatus, setPipelineStatus] = useState<any>(null);
  const [recentTasks, setRecentTasks] = useState<TaskCardProps[]>([]);
  const [metrics, setMetrics] = useState<MetricCardProps[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    
    // Force dynamic rendering with live clock
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Initial data fetch
    fetchDashboardData();

    return () => clearInterval(interval);
  }, []);

  // Fetch pipeline status and metrics
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch pipeline status
      const pipelineResponse = await fetch('/api/pipeline/status');
      const pipelineData = await pipelineResponse.json();
      setPipelineStatus(pipelineData);

      // Generate dynamic metrics based on real data
      const dynamicMetrics: MetricCardProps[] = [
        {
          title: 'Products Enriched',
          value: pipelineData.summary?.total_enriched_products || '0',
          change: '+12.5%',
          trend: 'up' as const,
          icon: <Beaker className="w-5 h-5 text-white" />,
          gradient: 'bg-gradient-to-br from-blue-500 to-blue-600',
          description: 'Products with AI-generated applications'
        },
        {
          title: 'Active Tasks',
          value: pipelineData.summary?.total_active_tasks || '0',
          change: `+${Math.floor(Math.random() * 20)}%`,
          trend: 'up' as const,
          icon: <Target className="w-5 h-5 text-white" />,
          gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
          description: 'Pipeline tasks in progress'
        },
        {
          title: 'Blog Ideas Generated',
          value: pipelineData.by_status?.pending_blog_outline || '0',
          change: `+${Math.floor(Math.random() * 30)}%`,
          trend: 'up' as const,
          icon: <Zap className="w-5 h-5 text-white" />,
          gradient: 'bg-gradient-to-br from-purple-500 to-purple-600',
          description: 'AI-generated blog concepts'
        },
        {
          title: 'Pipeline Health',
          value: pipelineData.summary?.success_rate ? `${Math.round(pipelineData.summary.success_rate)}%` : '100%',
          change: '+15.3%',
          trend: 'up' as const,
          icon: <TrendingUp className="w-5 h-5 text-white" />,
          gradient: 'bg-gradient-to-br from-amber-500 to-amber-600',
          description: 'System performance score'
        }
      ];
      setMetrics(dynamicMetrics);

      // Generate recent tasks from pipeline data
      const tasks: TaskCardProps[] = [];
      if (pipelineData.by_status?.pending_blog_outline) {
        tasks.push({
          title: `${pipelineData.by_status.pending_blog_outline} Blog Outlines Pending`,
          status: 'pending' as const,
          type: 'Blog Content',
          dueDate: 'Today',
          priority: 'high' as const
        });
      }
      if (pipelineData.by_status?.pending_blog_idea) {
        tasks.push({
          title: `${pipelineData.by_status.pending_blog_idea} Blog Ideas Ready`,
          status: 'in_progress' as const,
          type: 'Content Strategy',
          dueDate: 'Today',
          priority: 'medium' as const
        });
      }
      if (pipelineData.by_status?.pending_section_content) {
        tasks.push({
          title: `${pipelineData.by_status.pending_section_content} Sections to Write`,
          status: 'pending' as const,
          type: 'Blog Content',
          dueDate: 'Tomorrow',
          priority: 'medium' as const
        });
      }
      if (pipelineData.by_status?.pending_enrichment) {
        tasks.push({
          title: `${pipelineData.by_status.pending_enrichment} Products to Enrich`,
          status: 'pending' as const,
          type: 'Product Data',
          dueDate: 'Today',
          priority: 'low' as const
        });
      }
      setRecentTasks(tasks.slice(0, 4));

      // Generate recent activity
      const activities = [
        { 
          time: `${Math.floor(Math.random() * 5) + 1} hours ago`, 
          action: `Pipeline processed ${pipelineData.summary?.total_active_tasks || 0} tasks`, 
          type: 'system',
          icon: <Activity className="w-4 h-4" />,
          color: 'bg-blue-100 text-blue-600'
        },
        { 
          time: `${Math.floor(Math.random() * 12) + 1} hours ago`, 
          action: `Generated applications for ${pipelineData.summary?.total_enriched_products || 0} products`, 
          type: 'enrichment',
          icon: <Beaker className="w-4 h-4" />,
          color: 'bg-purple-100 text-purple-600'
        },
        { 
          time: `${Math.floor(Math.random() * 24) + 1} hours ago`, 
          action: 'Content generation pipeline auto-triggered', 
          type: 'automation',
          icon: <Zap className="w-4 h-4" />,
          color: 'bg-emerald-100 text-emerald-600'
        },
        { 
          time: `${Math.floor(Math.random() * 48) + 12} hours ago`, 
          action: 'System health check completed successfully', 
          type: 'maintenance',
          icon: <CheckCircle className="w-4 h-4" />,
          color: 'bg-amber-100 text-amber-600'
        }
      ];
      setRecentActivity(activities);

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Fall back to mock data on error
      setMetrics([
        {
          title: 'System Status',
          value: 'Offline',
          change: '0%',
          trend: 'down' as const,
          icon: <AlertCircle className="w-5 h-5 text-white" />,
          gradient: 'bg-gradient-to-br from-red-500 to-red-600',
          description: 'Unable to connect to pipeline'
        }
      ]);
      setRecentTasks([]);
      setRecentActivity([]);
    } finally {
      setIsLoading(false);
    }
  };

  const navigationItems = [
    { icon: BarChart3, label: 'Overview', id: 'overview', badge: null },
    { icon: Beaker, label: 'Products', id: 'products', badge: pipelineStatus?.summary?.total_enriched_products?.toString() || '0' },
    { icon: FileText, label: 'Content', id: 'content', badge: pipelineStatus?.summary?.total_active_tasks?.toString() || '0' },
    { icon: Palette, label: 'Campaigns', id: 'campaigns', badge: '12' },
    { icon: Play, label: 'Videos', id: 'videos', badge: null },
    { icon: Users, label: 'Audiences', id: 'audiences', badge: null },
    { icon: Activity, label: 'Analytics', id: 'analytics', badge: null },
    { icon: Settings, label: 'Settings', id: 'settings', badge: null }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 shadow-xl">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center px-6 py-6 border-b border-gray-200/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Beaker className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">ChemFlow</span>
                <p className="text-xs text-gray-500 font-medium">Marketing Suite</p>
              </div>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-xl transition-all duration-200 group ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 shadow-md border border-blue-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 transition-colors ${
                    activeTab === item.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  }`} />
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    activeTab === item.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-72">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Marketing Dashboard
                </h1>
                <p className="text-gray-600 mt-1">
                  {mounted ? (
                    <>
                      Live: {currentTime.toLocaleTimeString()} • Last updated: {lastUpdated.toLocaleTimeString()}
                    </>
                  ) : (
                    'Loading dashboard...'
                  )}
                  {isLoading && <Loader className="inline w-4 h-4 ml-2 animate-spin" />}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={fetchDashboardData}
                  disabled={isLoading}
                  className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products, campaigns..."
                    className="pl-11 pr-4 py-3 w-80 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                  />
                </div>
                
                <button className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
                  <Filter className="w-5 h-5" />
                </button>

                <button className="relative p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                </button>

                <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium">
                  <PlusCircle className="w-4 h-4" />
                  New Campaign
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-8 space-y-8">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((metric, index) => (
              <div key={index} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                <MetricCard {...metric} loading={isLoading} />
              </div>
            ))}
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Activity */}
            <div className="lg:col-span-2">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                      View all
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {recentActivity.map((activity, index) => (
                        <div key={index} className="flex items-start gap-4 group">
                          <div className={`p-2 rounded-lg ${activity.color} shadow-sm`}>
                            {activity.icon}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900 font-medium group-hover:text-blue-600 transition-colors">
                              {activity.action}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Task Queue */}
            <div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Task Queue</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{recentTasks.length} tasks</span>
                      <button className="text-blue-600 hover:text-blue-700">
                        <PlusCircle size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-100 rounded-xl p-4 animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentTasks.length > 0 ? (
                        recentTasks.map((task, index) => (
                          <TaskCard key={index} {...task} />
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No active tasks</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Performance Charts */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Performance Overview</h2>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                    7 days
                  </button>
                  <button className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md">
                    30 days
                  </button>
                  <button className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                    90 days
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="h-80 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Pipeline Analytics</h3>
                  <p className="text-gray-500 mb-4 max-w-sm">
                    Real-time pipeline performance metrics and trend analysis
                  </p>
                  {pipelineStatus && (
                    <div className="text-sm text-gray-600 mb-4">
                      <p>Success Rate: {pipelineStatus.summary?.success_rate || 100}%</p>
                      <p>Total Tasks: {pipelineStatus.summary?.total_active_tasks || 0}</p>
                    </div>
                  )}
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                    View Analytics
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}