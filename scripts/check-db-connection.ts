import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkDatabaseConnection() {
  console.log('=== DATABASE CONNECTION TROUBLESHOOTER ===\n');

  // Check if DATABASE_URL is set
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('❌ DATABASE_URL environment variable is not set');
    console.log('\n🔧 To fix this:');
    console.log('1. Create or check your .env.local file');
    console.log('2. Add your DATABASE_URL like this:');
    console.log('   DATABASE_URL="postgresql://username:password@host:port/database"');
    console.log('\n📝 Example formats:');
    console.log('   Local: DATABASE_URL="postgresql://postgres:password@localhost:5432/marketing"');
    console.log('   Remote: DATABASE_URL="postgresql://user:pass@host.com:5432/dbname"');
    console.log('   Supabase: DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"');
    return;
  }

  console.log('✅ DATABASE_URL is set');
  
  // Parse and validate the URL (without revealing the password)
  try {
    const url = new URL(databaseUrl);
    console.log(`📊 Connection details:`);
    console.log(`   Protocol: ${url.protocol}`);
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Port: ${url.port || '5432'}`);
    console.log(`   Database: ${url.pathname.slice(1)}`);
    console.log(`   Username: ${url.username}`);
    console.log(`   Password: ${url.password ? '[SET]' : '[NOT SET]'}`);
    
    // Check for common issues
    if (!url.password) {
      console.log('\n❌ Password is missing from DATABASE_URL');
      console.log('🔧 Make sure your DATABASE_URL includes the password:');
      console.log('   postgresql://username:PASSWORD@host:port/database');
      return;
    }
    
    if (url.password.includes('%')) {
      console.log('\n⚠️  Password contains URL-encoded characters');
      console.log('🔧 If your password has special characters, they should be URL-encoded:');
      console.log('   @ → %40, : → %3A, / → %2F, etc.');
    }
    
  } catch (error: any) {
    console.log('❌ Invalid DATABASE_URL format:', error.message);
    console.log('\n🔧 Expected format:');
    console.log('   postgresql://username:password@host:port/database');
    return;
  }

  // Try to connect
  console.log('\n🔌 Testing database connection...');
  
  let pool: Pool | null = null;
  try {
    pool = new Pool({ 
      connectionString: databaseUrl,
      // Add some connection options that might help
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });
    
    // Test basic connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();
    
    console.log('✅ Database connection successful!');
    console.log(`📅 Server time: ${result.rows[0].current_time}`);
    console.log(`🗄️  PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
    
    // Check if pgvector is installed
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('✅ pgvector extension is available');
    } catch (vectorError: any) {
      console.log('⚠️  pgvector extension issue:', vectorError.message);
      console.log('🔧 You may need to install pgvector for RAG functionality');
    }
    
    // Check for RAG schema
    const { rows: schemas } = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'rag_system'
    `);
    
    if (schemas.length > 0) {
      console.log('✅ rag_system schema exists');
      
      // Check for RAG tables
      const { rows: tables } = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'rag_system'
      `);
      
      if (tables.length > 0) {
        console.log(`✅ RAG tables found: ${tables.map(t => t.table_name).join(', ')}`);
      } else {
        console.log('⚠️  rag_system schema exists but no tables found');
      }
    } else {
      console.log('⚠️  rag_system schema not found');
      console.log('🔧 You may need to run database migrations to set up RAG tables');
    }
    
  } catch (error: any) {
    console.log('❌ Database connection failed:', error.message);
    
    // Provide specific troubleshooting based on error
    if (error.message.includes('SASL') || error.message.includes('password')) {
      console.log('\n🔧 Authentication issues:');
      console.log('1. Check your username and password are correct');
      console.log('2. If using special characters in password, URL-encode them');
      console.log('3. Try connecting with a database client (like pgAdmin) to verify credentials');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log('\n🔧 Connection issues:');
      console.log('1. Check the hostname and port are correct');
      console.log('2. Make sure the database server is running');
      console.log('3. Check firewall settings');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('\n🔧 Database issues:');
      console.log('1. Make sure the database name is correct');
      console.log('2. Create the database if it doesn\'t exist');
    } else if (error.message.includes('SSL')) {
      console.log('\n🔧 SSL issues:');
      console.log('1. Try adding ?sslmode=require to your DATABASE_URL');
      console.log('2. Or ?sslmode=disable for local development');
    }
    
    console.log('\n📚 Common DATABASE_URL formats:');
    console.log('Local PostgreSQL:');
    console.log('  DATABASE_URL="postgresql://postgres:password@localhost:5432/marketing"');
    console.log('Supabase:');
    console.log('  DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres"');
    console.log('Railway:');
    console.log('  DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/railway"');
    console.log('Neon:');
    console.log('  DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]/[DB]?sslmode=require"');
    
  } finally {
    if (pool) {
      await pool.end();
    }
  }
  
  console.log('\n================================\n');
}

if (require.main === module) {
  checkDatabaseConnection();
}

export { checkDatabaseConnection }; 