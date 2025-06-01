import { Command } from 'commander';
import { db } from '../../lib/db';
import { shopifySyncProducts, shopifySyncState } from '../../lib/db/schema';
import { getAllShopifyProducts, getShopifyMetafields, ShopifyProduct, ShopifyMetafield } from '@/lib/shopify/client';
import { eq, sql } from 'drizzle-orm';

const syncCommand = new Command('sync');

// Helper to extract specific metafield value
const findMetafieldValue = (metafields: ShopifyMetafield[], namespace: string, key: string): any | undefined => {
  const metafield = metafields.find(mf => mf.namespace === namespace && mf.key === key);
  if (!metafield) return undefined;
  
  // Shopify stores some complex types as JSON strings in metafields
  if (metafield.type === 'json_string' && typeof metafield.value === 'string') {
    try {
      return JSON.parse(metafield.value);
    } catch (e) {
      console.warn(`Failed to parse JSON metafield ${namespace}.${key}:`, e);
      return metafield.value; // return as string if parsing fails
    }
  }
  return metafield.value;
};

syncCommand
  .description('Sync data from Shopify and other sources')
  .option('-s, --source <source>', 'Data source to sync', 'shopify')
  .option('-e, --entity <entity>', 'Entity type to sync (products, collections, customers, orders)', 'products')
  .option('--full', 'Perform a full sync, ignoring last sync state', false)
  .option('--metafields', 'Fetch metafields for products (increases API calls)', false)
  .option('--namespace <namespace>', 'Metafield namespace to use for chemical data', 'chemflow_custom')
  .action(async (options) => {
    if (options.source !== 'shopify') {
      console.log(`Sync for source '${options.source}' not yet implemented.`);
      return;
    }

    console.log(`🚀 Starting Shopify sync for entity: ${options.entity}`);

    const entityType = options.entity;
    let currentSyncState;
    if (!options.full) {
      currentSyncState = await db.query.shopifySyncState.findFirst({
        where: eq(shopifySyncState.entity_type, entityType)
      });
    }
    
    // Initialize or update sync state to 'running'
    await db.insert(shopifySyncState).values({
        entity_type: entityType,
        status: 'running',
        last_sync_start_time: new Date(),
        last_error: null,
      }).onConflictDoUpdate({
        target: shopifySyncState.entity_type,
        set: { 
          status: 'running',
          last_sync_start_time: new Date(),
          last_error: null,
          updated_at: new Date()
        }
      });

    try {
      if (entityType === 'products') {
        let totalSynced = 0;
        
        console.log('Fetching products from Shopify...');
        const shopifyProductsData = await getAllShopifyProducts((fetchedCount) => {
          totalSynced = fetchedCount;
          console.log(`Fetched ${fetchedCount} products so far...`);
        });
        
        console.log(`Total products fetched from Shopify: ${shopifyProductsData.length}`);

        // Define your metafield namespaces and keys for chemical data
        const METAFIELD_NAMESPACE_CHEMICAL = options.namespace; // Default: 'chemflow_custom'
        const METAFIELD_KEY_CAS = 'cas_number';
        const METAFIELD_KEY_FORMULA = 'chemical_formula';
        const METAFIELD_KEY_PROPERTIES = 'properties_json'; // Assuming JSON string
        const METAFIELD_KEY_SAFETY = 'safety_info_json';   // Assuming JSON string

        for (const [index, shopifyProduct] of shopifyProductsData.entries()) {
          let productMetafields: ShopifyMetafield[] = [];
          
          // Fetch metafields if requested
          if (options.metafields) {
            try {
              productMetafields = await getShopifyMetafields('products', shopifyProduct.id);
              // Small delay after each metafield fetch to be kind to API limits
              await new Promise(resolve => setTimeout(resolve, 250));
            } catch (mfError) {
              console.warn(`Could not fetch metafields for product ${shopifyProduct.id}:`, (mfError as Error).message);
            }
          }

          const productToUpsert = {
            productId: shopifyProduct.id,
            title: shopifyProduct.title,
            description: shopifyProduct.body_html,
            productType: shopifyProduct.product_type,
            vendor: shopifyProduct.vendor,
            handle: shopifyProduct.handle,
            status: shopifyProduct.status,
            tags: shopifyProduct.tags,
            publishedAt: shopifyProduct.published_at ? new Date(shopifyProduct.published_at) : null,
            createdAtShopify: new Date(shopifyProduct.created_at),
            updatedAtShopify: new Date(shopifyProduct.updated_at),
            variants: shopifyProduct.variants as any, // Cast to any if types don't match exactly
            images: shopifyProduct.images as any,
            options: shopifyProduct.options as any,
            metafields: productMetafields as any, // Store all fetched metafields (this is where CAS, formula, etc. will be stored raw)
            syncDate: new Date(),
          };

          await db.insert(shopifySyncProducts)
            .values(productToUpsert)
            .onConflictDoUpdate({
              target: shopifySyncProducts.productId, // Use Shopify's product ID for conflict
              set: {
                ...productToUpsert, // Update all fields
                syncDate: new Date(), // Always update syncDate
              }
            });

          // Progress indicator
          if ((index + 1) % 10 === 0) {
            console.log(`Processed ${index + 1}/${shopifyProductsData.length} products...`);
          }
        }
        
        console.log(`✅ Synced ${shopifyProductsData.length} products.`);
        
        // Update sync state to completed
        await db.update(shopifySyncState)
            .set({ 
                status: 'completed',
                last_processed_count: shopifyProductsData.length,
                total_processed_count: sql`COALESCE(${shopifySyncState.total_processed_count}, 0) + ${shopifyProductsData.length}`,
                updated_at: new Date()
            })
            .where(eq(shopifySyncState.entity_type, entityType));

      } else if (entityType === 'collections') {
        console.log('Syncing collections... (Not yet fully implemented)');
        // TODO: Implement getAllShopifyCollections and upsert logic
        // Remember to update shopifySyncState
        await db.update(shopifySyncState)
            .set({ status: 'skipped', updated_at: new Date() })
            .where(eq(shopifySyncState.entity_type, entityType));
            
      } else if (entityType === 'customers') {
        console.log('Syncing customers... (Not yet fully implemented)');
        // TODO: Implement getAllShopifyCustomers and upsert logic
        await db.update(shopifySyncState)
            .set({ status: 'skipped', updated_at: new Date() })
            .where(eq(shopifySyncState.entity_type, entityType));
            
      } else if (entityType === 'orders') {
        console.log('Syncing orders... (Not yet fully implemented)');
        // TODO: Implement getAllShopifyOrders and upsert logic
        await db.update(shopifySyncState)
            .set({ status: 'skipped', updated_at: new Date() })
            .where(eq(shopifySyncState.entity_type, entityType));
            
      } else {
        console.log(`Entity type '${entityType}' sync not implemented yet.`);
         await db.update(shopifySyncState)
            .set({ status: 'skipped', updated_at: new Date() })
            .where(eq(shopifySyncState.entity_type, entityType));
      }
      
      console.log('🎉 Shopify sync completed.');
      
    } catch (error) {
        console.error(`❌ Error during Shopify sync for ${entityType}:`, error);
        await db.update(shopifySyncState)
            .set({ 
                status: 'error', 
                last_error: (error as Error).message, 
                updated_at: new Date() 
            })
            .where(eq(shopifySyncState.entity_type, entityType));
        process.exit(1);
    }
  });

// Add a subcommand to check sync status
syncCommand
  .command('status')
  .description('Check the status of sync operations')
  .option('-e, --entity <entity>', 'Entity type to check status for')
  .action(async (options) => {
    try {
      let syncStates;
      if (options.entity) {
        syncStates = await db.query.shopifySyncState.findMany({
          where: eq(shopifySyncState.entity_type, options.entity)
        });
      } else {
        syncStates = await db.query.shopifySyncState.findMany();
      }

      if (syncStates.length === 0) {
        console.log('No sync states found.');
        return;
      }

      console.log('\n📊 Sync Status Report:');
      console.log('========================');
      
      for (const state of syncStates) {
        console.log(`\nEntity: ${state.entity_type}`);
        console.log(`Status: ${state.status}`);
        console.log(`Last Sync: ${state.last_sync_start_time || 'Never'}`);
        console.log(`Last Processed: ${state.last_processed_count || 0} items`);
        console.log(`Total Processed: ${state.total_processed_count || 0} items`);
        if (state.last_error) {
          console.log(`Last Error: ${state.last_error}`);
        }
        console.log(`Updated: ${state.updated_at}`);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
      process.exit(1);
    }
  });

export { syncCommand }; 