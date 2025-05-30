import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const DATABASE_URL = "postgres://default:Lm6cG2iOHprI@ep-blue-bar-a4hj4ojg-pooler.us-east-1.aws.neon.tech/verceldb?sslmode=require";

async function checkSchema() {
  const pool = new Pool({
    connectionString: DATABASE_URL
  });
  
  const db = drizzle(pool);

  try {
    // Check if marketing schema exists
    const schemas = await db.execute(sql`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'marketing'
    `);
    console.log('Marketing schema exists:', schemas.rows.length > 0);

    if (schemas.rows.length > 0) {
      // Check if blog_posts table exists
      const tables = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'marketing' 
        AND table_name = 'blog_posts'
      `);
      console.log('Blog posts table exists:', tables.rows.length > 0);

      if (tables.rows.length > 0) {
        // Check table structure
        const columns = await db.execute(sql`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'marketing' 
          AND table_name = 'blog_posts'
        `);
        console.log('Blog posts table structure:', columns.rows);
      }
    }
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkSchema(); 