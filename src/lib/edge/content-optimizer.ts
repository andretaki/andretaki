import type { Product } from '../types/product';
import { ChemicalApplicationSchema } from '../ai/structured-content';

export const config = { runtime: 'edge' };

interface OptimizedContent {
  html: string;
  chemical: Product;
  safetyLevel: string;
  region: string;
  language: string;
  units: 'metric' | 'imperial';
  currency: string;
}

const REGION_CONFIGS = {
  US: { language: 'en', units: 'imperial', currency: 'USD' },
  EU: { language: 'en', units: 'metric', currency: 'EUR' },
  UK: { language: 'en', units: 'metric', currency: 'GBP' },
  CN: { language: 'zh', units: 'metric', currency: 'CNY' },
  JP: { language: 'ja', units: 'metric', currency: 'JPY' },
  // Add more regions as needed
} as const;

export default async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const chemicalId = searchParams.get('id');
  const region = request.headers.get('CF-IPCountry') || 'US';
  
  if (!chemicalId) {
    return new Response('Chemical ID is required', { status: 400 });
  }

  try {
    // Region-specific content optimization
    const content = await getOptimizedContent(chemicalId, region);
    
    // Smart caching based on chemical volatility and region
    const cacheControl = calculateCacheControl(content.chemical, region);
    
    // Generate region-specific HTML
    const html = await generateRegionalHTML(content);
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': cacheControl,
        'X-Chemical-Safety': content.safetyLevel,
        'X-Region': content.region,
        'X-Language': content.language,
        'X-Units': content.units,
        'X-Currency': content.currency,
      },
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function getOptimizedContent(chemicalId: string, region: string): Promise<OptimizedContent> {
  // Fetch chemical data from KV store or database
  const chemical = await fetchChemicalData(chemicalId);
  
  // Get region-specific configuration
  const regionConfig = REGION_CONFIGS[region as keyof typeof REGION_CONFIGS] || REGION_CONFIGS.US;
  
  // Determine safety level based on regional regulations
  const safetyLevel = await determineSafetyLevel(chemical, region);
  
  return {
    html: '', // Will be generated later
    chemical,
    safetyLevel,
    region,
    ...regionConfig,
  };
}

function calculateCacheControl(chemical: Product, region: string): string {
  // Base cache duration on chemical volatility and region
  const volatility = determineChemicalVolatility(chemical);
  const regionFactor = getRegionCacheFactor(region);
  
  // More volatile chemicals have shorter cache times
  const maxAge = Math.floor(3600 * volatility * regionFactor); // in seconds
  
  return `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`;
}

async function generateRegionalHTML(content: OptimizedContent): Promise<string> {
  const { chemical, language, units, currency } = content;
  
  // Convert units if necessary
  const displayUnits = convertToDisplayUnits(chemical, units);
  
  // Generate localized content
  return `
    <!DOCTYPE html>
    <html lang="${language}">
      <head>
        <title>${chemical.title} - Chemical Product</title>
        <meta name="description" content="${chemical.description}">
        <meta name="safety-level" content="${content.safetyLevel}">
      </head>
      <body>
        <h1>${chemical.title}</h1>
        <div class="product-details">
          <p>CAS Number: ${chemical.casNumber}</p>
          <p>Molecular Formula: ${chemical.molecularFormula}</p>
          <p>Purity: ${displayUnits.purity}%</p>
          <p>Price: ${formatCurrency(chemical.price || 0, currency)}</p>
        </div>
        <div class="safety-info">
          <h2>Safety Information</h2>
          <ul>
            ${chemical.safetyData?.hazardStatements?.map(h => `<li>${h}</li>`).join('') || ''}
          </ul>
        </div>
      </body>
    </html>
  `;
}

// Helper functions
function determineChemicalVolatility(chemical: Product): number {
  // Implement chemical volatility calculation based on properties
  return 1.0; // Default value
}

function getRegionCacheFactor(region: string): number {
  // Different regions might need different cache durations
  const factors = {
    US: 1.0,
    EU: 1.2,
    UK: 1.2,
    CN: 0.8,
    JP: 0.8,
  };
  return factors[region as keyof typeof factors] || 1.0;
}

function convertToDisplayUnits(chemical: Product, targetUnits: 'metric' | 'imperial') {
  // Implement unit conversion logic
  return {
    purity: chemical.purity,
    // Add other conversions as needed
  };
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

async function fetchChemicalData(id: string): Promise<Product> {
  // Implement chemical data fetching from KV store or database
  return {
    id,
    title: 'Sample Chemical',
    casNumber: '123-45-6',
  };
}

async function determineSafetyLevel(chemical: Product, region: string): Promise<string> {
  // Implement safety level determination based on regional regulations
  return 'medium';
} 