# Proposed Topics Management UI - Conceptual Design

This document outlines the UI concept for managing `marketing.proposed_topics` using the API endpoints we've built.

## Page Structure: `/dashboard/content/topics`

### Main Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Proposed Topics Management                                          │
├─────────────────────────────────────────────────────────────────────┤
│ [+ Create New Topic] [🔄 Refresh] [📊 Analytics] [⚙️ Settings]     │
├─────────────────────────────────────────────────────────────────────┤
│ Filters & Search                                                    │
│ ┌─────────────┬─────────────┬─────────────┬─────────────────────────┐│
│ │Status: [▼] │Source: [▼] │Product: [▼] │Search: [____________] 🔍││
│ └─────────────┴─────────────┴─────────────┴─────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│ Topics Table (Sortable & Paginated)                                │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │☑️ │Title            │Status    │Priority │Product │Actions     │ │
│ ├───┼─────────────────┼──────────┼─────────┼────────┼─────────────┤ │
│ │☑️ │Advanced Chemical│Proposed  │8.5      │ChemX   │👁️ ✏️ ✅ ❌│ │
│ │☑️ │Safety Protocols │Approved  │9.0      │SafeChem│👁️ ✏️ 📝 🗑️│ │
│ │☑️ │Green Chemistry  │Pipeline  │7.5      │EcoChem │👁️ ✏️ 📄   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ [< Previous] Page 1 of 5 [Next >] │ Showing 1-20 of 87 topics     │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Header Actions Bar
- **Create New Topic**: Opens create modal/form
- **Refresh**: Reload topics from API
- **Analytics**: Show topic performance dashboard
- **Settings**: Configure similarity thresholds, auto-approval rules

### 2. Filters & Search Panel
```typescript
interface FilterState {
  status: 'all' | 'proposed' | 'approved_for_pipeline' | 'rejected' | 'archived';
  sourceType: 'all' | 'agent_innovator' | 'manual_entry' | 'agent_seo_gap';
  associatedProductDbId: number | null;
  searchTerm: string;
  sortBy: 'createdAt' | 'priorityScore' | 'updatedAt' | 'topicTitle';
  sortOrder: 'asc' | 'desc';
}
```

**Features:**
- Status dropdown with counts: "Proposed (23), Approved (15), Rejected (5)"
- Source type filter to see which agent/method generated topics
- Product filter (dropdown populated from Shopify products)
- Real-time search across title, keywords, and notes
- Sort controls for each column

### 3. Topics Table

**Columns:**
1. **Checkbox** - For batch operations
2. **Topic Title** - Sortable, clickable to view details
3. **Status** - Color-coded badges
4. **Priority Score** - Sortable, with visual indicators (high/medium/low)
5. **Associated Product** - Product name/link
6. **SEO Data** - Search volume, keyword difficulty (if available)
7. **Source** - Agent/manual with icon
8. **Created/Updated** - Relative time with tooltip
9. **Actions** - Quick action buttons

**Status Color Coding:**
- 🟡 **Proposed** - Yellow
- 🟢 **Approved for Pipeline** - Green  
- 🔵 **Pipeline Active** - Blue
- ✅ **Published** - Dark Green
- 🔴 **Rejected** - Red
- ⚫ **Archived** - Gray

### 4. Action Buttons (Per Row)

```typescript
interface TopicActions {
  view: () => void;      // 👁️ View details modal
  edit: () => void;      // ✏️ Edit form modal
  approve: () => void;   // ✅ Quick approve
  reject: () => void;    // ❌ Quick reject
  archive: () => void;   // 🗑️ Archive/delete
  pipeline: () => void;  // 📝 Send to content pipeline
  blog: () => void;      // 📄 View associated blog post
}
```

### 5. Create/Edit Topic Modal

```
┌─────────────────────────────────────────┐
│ Create New Topic                    [×] │
├─────────────────────────────────────────┤
│ Topic Title*                            │
│ ┌─────────────────────────────────────┐ │
│ │ [___________________________]      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Primary Keyword                         │
│ ┌─────────────────────────────────────┐ │
│ │ [___________________________]      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Secondary Keywords                      │
│ ┌─────────────────────────────────────┐ │
│ │ [tag1] [tag2] [+add]               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Associated Product                      │
│ ┌─────────────────────────────────────┐ │
│ │ [Select Product ▼]                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Priority Score (0-10)                   │
│ ┌─────────────────────────────────────┐ │
│ │ [■■■■■■■■□□] 8.0                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Strategic Theme                         │
│ ┌─────────────────────────────────────┐ │
│ │ [Select Theme ▼]                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Notes                                   │
│ ┌─────────────────────────────────────┐ │
│ │ [                               ] │ │
│ │ [                               ] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Cancel] [Check Similarity] [Save Topic]│
└─────────────────────────────────────────┘
```

**Form Features:**
- Real-time validation
- "Check Similarity" button to preview similar topics before saving
- Auto-complete for keywords based on existing topics
- Product search/filter dropdown
- Strategic theme dropdown (predefined categories)

### 6. Topic Details Modal

```
┌───────────────────────────────────────────────────────────────┐
│ Topic Details: "Advanced Chemical Synthesis..."          [×] │
├───────────────────────────────────────────────────────────────┤
│ [Edit Topic] [Approve] [Reject] [Archive] [Send to Pipeline] │
├───────────────────────────────────────────────────────────────┤
│ Basic Information                                             │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Title: Advanced Chemical Synthesis Techniques              ││
│ │ Status: 🟡 Proposed                                        ││
│ │ Priority: ★★★★★★★★☆☆ (8.5/10)                            ││
│ │ Created: 2 hours ago by InnovatorAgent                     ││
│ │ Updated: 1 hour ago                                        ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                               │
│ SEO & Keywords                                                │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Primary: chemical synthesis                                 ││
│ │ Secondary: [industrial chemistry] [synthesis methods]      ││
│ │ Search Volume: 1,200/month                                 ││
│ │ Keyword Difficulty: 65/100                                 ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                               │
│ Associations                                                  │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Product: ChemicalX Industrial Catalyst                     ││
│ │ Strategic Theme: Technical Education                        ││
│ │ Source: agent_innovator (product_focus: catalyst_systems)  ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                               │
│ Content Pipeline                                              │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Pipeline Task: Not started                                 ││
│ │ Blog Post: None                                            ││
│ │ [▶️ Start Content Pipeline]                                ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                               │
│ Notes & Analysis                                              │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Generated for app theme: Advanced Chemical Processes       ││
│ │ Audience: Chemical engineers and process managers          ││
│ │                                                            ││
│ │ SERP Analysis: Competitor gap identified for industrial   ││
│ │ applications. Top 3 competitors don't cover XYZ aspects.  ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                               │
│ [Close] [Edit Topic] [Duplicate] [Export]                    │
└───────────────────────────────────────────────────────────────┘
```

### 7. Batch Operations Panel

When topics are selected:
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔢 3 topics selected                                           │
│ [Approve All] [Reject All] [Archive All] [Set Theme] [Export]   │
└─────────────────────────────────────────────────────────────────┘
```

## React Component Structure

```typescript
// Main component
function ProposedTopicsManager() {
  const [topics, setTopics] = useState<ProposedTopic[]>([]);
  const [filters, setFilters] = useState<FilterState>({...});
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<ProposedTopic | null>(null);
  
  // API integration hooks
  const { data, loading, refetch } = useProposedTopics(filters);
  
  return (
    <div className="proposed-topics-manager">
      <TopicsHeader onCreateNew={() => setShowCreateModal(true)} />
      <TopicsFilters filters={filters} onChange={setFilters} />
      <TopicsTable 
        topics={topics}
        selectedTopics={selectedTopics}
        onSelectTopic={handleSelectTopic}
        onActionClick={handleTopicAction}
      />
      <TopicsPagination {...paginationProps} />
      
      {/* Modals */}
      <CreateTopicModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={refetch}
      />
      <EditTopicModal
        topic={editingTopic}
        isOpen={!!editingTopic}
        onClose={() => setEditingTopic(null)}
        onSuccess={refetch}
      />
    </div>
  );
}
```

## API Integration Hooks

```typescript
function useProposedTopics(filters: FilterState) {
  return useQuery({
    queryKey: ['proposed-topics', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as any);
      const response = await fetch(`/api/marketing/proposed-topics?${params}`);
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

function useCreateTopic() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (topicData: CreateTopicData) => {
      const response = await fetch('/api/marketing/proposed-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topicData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create topic');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposed-topics'] });
    },
  });
}
```

## Advanced Features

### 1. Similarity Detection Preview
Before creating a topic, show similar existing topics:
```
⚠️ Similar topics found:
• "Chemical Synthesis Methods" (Similarity: 92%)
• "Advanced Industrial Synthesis" (Similarity: 87%)

Continue anyway? [Yes] [No, Edit Title]
```

### 2. Bulk Import
Allow CSV/Excel import of topics with validation and duplicate detection.

### 3. Topic Clustering
Visualize topics grouped by semantic similarity for content strategy planning.

### 4. SEO Integration Dashboard
- Show keyword opportunity scores
- Display competitor gap analysis
- Track topic performance over time

### 5. Approval Workflows
- Auto-approval rules based on priority score
- Manager approval for high-priority topics
- Integration with Slack/Teams for notifications

## Mobile Responsive Considerations

### Mobile Layout (< 768px)
- Stack filters vertically
- Card-based layout instead of table
- Simplified action menus
- Swipe gestures for quick actions

### Tablet Layout (768px - 1024px)
- Hybrid table/card view
- Collapsible filter panel
- Touch-optimized buttons

## Performance Considerations

1. **Virtual Scrolling** for large topic lists
2. **Debounced Search** to avoid excessive API calls
3. **Optimistic Updates** for status changes
4. **Background Sync** for real-time updates
5. **Caching Strategy** with React Query or SWR

## Future Enhancements

1. **AI-Powered Suggestions** for topic optimization
2. **Content Calendar Integration** 
3. **Social Media Cross-posting** planning
4. **ROI Tracking** per topic
5. **A/B Testing** for topic variations
6. **Integration with Google Search Console** for performance data 