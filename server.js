const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  host: process.env.BD_HOST,
  port: process.env.BD_PORT,
  user: process.env.BD_USER,
  database: process.env.BD_NAME,
  password: process.env.BD_PASS,
});

const CACHE_DIR = path.join(__dirname, 'cache');
const TABLE_COUNTS_CACHE = path.join(CACHE_DIR, 'table_counts.json');
const TABLES_LIST_CACHE = path.join(CACHE_DIR, 'tables_list.json');
const FOREIGN_KEYS_CACHE = path.join(CACHE_DIR, 'foreign_keys.json');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

app.get('/api/table-counts', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  
  try {
    if (!forceRefresh && fs.existsSync(TABLE_COUNTS_CACHE)) {
      const cachedData = JSON.parse(fs.readFileSync(TABLE_COUNTS_CACHE, 'utf8'));
      console.log('📦 Serving table counts from cache');
      return res.json(cachedData);
    }
    
    console.log('🔄 Fetching fresh table counts from database...');
    
    const query = `
      SELECT 
        table_schema as schemaname,
        table_name as tablename
      FROM information_schema.tables t
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name;
    `;
    
    const result = await pool.query(query);
    
    const tablesWithCounts = await Promise.all(
      result.rows.map(async (table) => {
        try {
          const countQuery = `SELECT COUNT(*) as count FROM "${table.schemaname}"."${table.tablename}"`;
          const countResult = await pool.query(countQuery);
          return {
            schemaname: table.schemaname,
            tablename: table.tablename,
            row_count: parseInt(countResult.rows[0].count)
          };
        } catch (err) {
          console.error(`Error counting ${table.schemaname}.${table.tablename}:`, err.message);
          return {
            schemaname: table.schemaname,
            tablename: table.tablename,
            row_count: 0
          };
        }
      })
    );
    
    tablesWithCounts.sort((a, b) => b.row_count - a.row_count);
    
    fs.writeFileSync(TABLE_COUNTS_CACHE, JSON.stringify(tablesWithCounts, null, 2));
    console.log('💾 Table counts cached to file');
    
    const tablesList = tablesWithCounts.map(t => ({
      schema: t.schemaname,
      table: t.tablename,
      fullName: `${t.schemaname}.${t.tablename}`
    }));
    fs.writeFileSync(TABLES_LIST_CACHE, JSON.stringify(tablesList, null, 2));
    console.log('💾 Tables list cached to file');
    
    res.json(tablesWithCounts);
  } catch (error) {
    console.error('Error fetching table counts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tables-list', async (req, res) => {
  try {
    if (fs.existsSync(TABLES_LIST_CACHE)) {
      const cachedData = JSON.parse(fs.readFileSync(TABLES_LIST_CACHE, 'utf8'));
      console.log('📦 Serving tables list from cache');
      return res.json(cachedData);
    }
    
    if (fs.existsSync(TABLE_COUNTS_CACHE)) {
      const tableCountsData = JSON.parse(fs.readFileSync(TABLE_COUNTS_CACHE, 'utf8'));
      const tablesList = tableCountsData.map(t => ({
        schema: t.schemaname,
        table: t.tablename,
        fullName: `${t.schemaname}.${t.tablename}`
      }));
      fs.writeFileSync(TABLES_LIST_CACHE, JSON.stringify(tablesList, null, 2));
      console.log('💾 Tables list cached to file');
      return res.json(tablesList);
    }
    
    res.json([]);
  } catch (error) {
    console.error('Error fetching tables list:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/foreign-keys', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  
  try {
    if (!forceRefresh && fs.existsSync(FOREIGN_KEYS_CACHE)) {
      const cachedData = JSON.parse(fs.readFileSync(FOREIGN_KEYS_CACHE, 'utf8'));
      console.log('📦 Serving foreign keys from cache');
      return res.json(cachedData);
    }
    
    console.log('🔄 Fetching foreign keys from database...');
    
    const query = `
      SELECT
        tc.constraint_name,
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY tc.table_schema, tc.table_name;
    `;
    
    const result = await pool.query(query);
    
    fs.writeFileSync(FOREIGN_KEYS_CACHE, JSON.stringify(result.rows, null, 2));
    console.log('💾 Foreign keys cached to file');
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching foreign keys:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/simulate-truncate', async (req, res) => {
  try {
    const { tableName, schemaName } = req.body;
    
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;
    
    const affectedTables = await findAffectedTables(fullTableName);
    
    res.json({ affectedTables });
  } catch (error) {
    console.error('Error simulating truncate:', error);
    res.status(500).json({ error: error.message });
  }
});

async function findAffectedTables(tableName, visited = new Set()) {
  if (visited.has(tableName)) {
    return [];
  }
  
  visited.add(tableName);
  
  const parts = tableName.split('.');
  const schema = parts.length > 1 ? parts[0] : 'public';
  const table = parts.length > 1 ? parts[1] : parts[0];
  
  const query = `
    SELECT
      tc.table_schema || '.' || tc.table_name as dependent_table,
      tc.table_name as table_only,
      kcu.column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = $1
      AND ccu.table_name = $2
      AND tc.table_schema NOT IN ('pg_catalog', 'information_schema');
  `;
  
  const result = await pool.query(query, [schema, table]);
  
  const affected = [{
    table: tableName,
    level: 0,
    reason: 'Target table'
  }];
  
  for (const row of result.rows) {
    const childAffected = await findAffectedTables(row.dependent_table, visited);
    
    affected.push({
      table: row.dependent_table,
      level: 1,
      reason: `References ${tableName} via ${row.column_name}`,
      delete_rule: row.delete_rule
    });
    
    for (const child of childAffected) {
      if (child.level > 0) {
        affected.push({
          ...child,
          level: child.level + 1
        });
      }
    }
  }
  
  return affected;
}

app.get('/api/table-details/:schema/:table', async (req, res) => {
  try {
    const { schema, table } = req.params;
    
    const countQuery = `SELECT COUNT(*) as count FROM ${schema}.${table}`;
    const countResult = await pool.query(countQuery);
    
    const columnsQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;
    const columnsResult = await pool.query(columnsQuery, [schema, table]);
    
    res.json({
      count: countResult.rows[0].count,
      columns: columnsResult.rows
    });
  } catch (error) {
    console.error('Error fetching table details:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  
  console.log(`\n🚀 Server running on port ${port}`);
  console.log(`\n📡 Access URLs:`);
  console.log(`   Local:    http://localhost:${port}`);
  console.log(`   Network:  http://127.0.0.1:${port}`);
  
  if (addresses.length > 0) {
    addresses.forEach(addr => {
      console.log(`   VPN/LAN:  http://${addr}:${port}`);
    });
  }
  
  console.log(`\n💡 Share the VPN/LAN URL with your colleagues!\n`);
});
