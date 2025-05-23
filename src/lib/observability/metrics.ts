import { metrics, trace } from '@opentelemetry/api';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import type { Product } from '../types/product';

interface ContentGenerationMetadata {
  productId: string;
  casNumber: string;
  contentType: string;
  model: string;
  tokens: number;
  category: string;
}

export class ChemicalMarketingMetrics {
  private meter = metrics.getMeter('chemical-marketing', '1.0.0');
  
  // Business metrics
  private contentGenerationRate = this.meter.createHistogram('content_generation_duration_ms');
  private conversionsByChemical = this.meter.createCounter('conversions_by_chemical');
  private campaignROI = this.meter.createObservableGauge('campaign_roi');
  
  constructor() {
    // Set up Prometheus exporter
    const exporter = new PrometheusExporter({
      port: 9464,
      endpoint: '/metrics',
    });
    
    // Register the exporter
    metrics.addMetricReader(exporter);
  }
  
  async trackContentGeneration(productId: string, duration: number, metadata: ContentGenerationMetadata) {
    const span = trace.getActiveSpan();
    span?.setAttributes({
      'product.id': productId,
      'product.cas': metadata.casNumber,
      'content.type': metadata.contentType,
      'ai.model': metadata.model,
      'ai.tokens': metadata.tokens,
    });
    
    this.contentGenerationRate.record(duration, {
      chemical_category: metadata.category,
      content_type: metadata.contentType,
    });
  }
  
  trackConversion(product: Product, value: number) {
    this.conversionsByChemical.add(value, {
      chemical_cas: product.casNumber,
      chemical_category: product.category || 'unknown',
    });
  }
  
  updateCampaignROI(campaignId: string, roi: number) {
    this.campaignROI.addCallback((result: { observe: (value: number, attributes: Record<string, string>) => void }) => {
      result.observe(roi, { campaign_id: campaignId });
    });
  }
  
  setupDashboards() {
    // Grafana dashboard configuration
    return {
      chemicalPerformance: {
        panels: [
          {
            title: 'Top Performing Chemicals by Content Engagement',
            query: 'rate(content_engagement_total[5m]) by (chemical_cas)',
          },
          {
            title: 'AI Content Generation Pipeline',
            query: 'histogram_quantile(0.95, content_generation_duration_ms)',
          },
          {
            title: 'Campaign ROI by Chemical Category',
            query: 'campaign_roi by (chemical_category)',
          },
          {
            title: 'Conversion Rate by Chemical',
            query: 'rate(conversions_by_chemical_total[1h]) by (chemical_cas)',
          },
        ],
      },
      aiPerformance: {
        panels: [
          {
            title: 'AI Model Performance',
            query: 'rate(ai_tokens_total[5m]) by (model)',
          },
          {
            title: 'Content Generation Success Rate',
            query: 'rate(content_generation_success_total[5m]) / rate(content_generation_total[5m])',
          },
        ],
      },
    };
  }
} 