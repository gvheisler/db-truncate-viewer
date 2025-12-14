# PostgreSQL Truncate Cascade Viewer

A web interface to visualize PostgreSQL database tables and safely simulate `TRUNCATE CASCADE` operations before executing them.

![Main Interface](docs/images/main-interface.png)

## 🎯 Purpose

This tool helps database administrators and developers:
- **Visualize** all tables and their row counts in a PostgreSQL database
- **Simulate** `TRUNCATE CASCADE` operations to see which tables would be affected
- **Protect** critical tables from accidental deletion
- **Identify** foreign key constraints that need to be removed to prevent cascade effects
- **Share** the tool with team members via VPN/LAN

## ✨ Features

### 1. 📊 Tables & Row Counts

![Tables View](docs/images/tables-view.png)

- View all database tables with row counts
- Sort by: most/least rows, name A-Z/Z-A
- Filter by schema (public, audit, etc.)
- Search by table name
- General database statistics
- **File-based cache** - data persists after rebuild
- **Instant loading** - uses cache until manual refresh
- **Refresh button** to force reload from database

### 2. ⚠️ Truncate Cascade Simulator

![Truncate Simulator](docs/images/truncate-simulator.png)

- Simulates `TRUNCATE ... CASCADE` effects before execution
- Shows all tables that would be affected
- **Protected tables selector** - choose which tables cannot be deleted
- Alerts if truncate would affect protected tables
- Visualizes dependency hierarchy
- **Constraints guide** - shows which FKs to remove to prevent cascade
- Selection saved in browser localStorage

### 3. 🔗 Foreign Key Relationships

![Relationships View](docs/images/relationships-view.png)

- Lists all foreign keys in the database
- Shows DELETE and UPDATE rules
- Search by table name
- Displays constraint names

## 🚀 Installation

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database
- Network access to your PostgreSQL server

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/gvheisler/db-truncate-viewer.git
cd db-truncate-viewer
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure database connection**

Copy the example environment file and edit with your database credentials:
```bash
cp .env.example .env
```

Edit `.env` with your database information:
```env
BD_HOST=your_database_host
BD_PORT=5432
BD_USER=your_database_user
BD_NAME=your_database_name
BD_PASS=your_database_password
```

4. **Start the server**
```bash
npm start
```

The server will display available access URLs:
```
🚀 Server running on port 3000

📡 Access URLs:
   Local:    http://localhost:3000
   Network:  http://127.0.0.1:3000
   VPN/LAN:  http://192.168.1.100:3000

💡 Share the VPN/LAN URL with your colleagues!
```

## 📖 Usage

### Viewing Tables
1. Access the application via the URL shown in the console
2. Navigate to the "Tables & Rows" tab
3. Sort and filter as needed
4. Click "🔄 Refresh" to reload data from database

### Configuring Protected Tables
1. Go to the "Truncate Simulator" tab
2. Click "🛡️ Protected Tables" to expand
3. Use search to find tables
4. Check the boxes for tables you want to protect
5. Click "🔄 Refresh List" if new tables were created

### Simulating Truncate Cascade
1. Configure protected tables first
2. Enter the schema and table name you want to truncate
3. Click "Simulate TRUNCATE CASCADE"
4. Review affected tables and check if any are protected
5. Use the "Constraints Guide" to see which FKs need removal

**IMPORTANT:** This tool only SIMULATES. To execute the actual truncate:

```sql
-- 1. Remove constraints (if necessary)
ALTER TABLE schema.table DROP CONSTRAINT IF EXISTS constraint_name;

-- 2. Execute truncate
TRUNCATE TABLE schema.table RESTART IDENTITY CASCADE;

-- 3. Recreate constraints (if necessary)
ALTER TABLE schema.table ADD CONSTRAINT constraint_name ...;
```

## 🌐 Network Sharing

The server accepts connections from any IP address. Share the VPN/LAN URL with colleagues on the same network to collaborate.

## 💾 Data Caching

The application maintains cache in JSON files in the `cache/` directory:
- `table_counts.json` - Row counts for all tables
- `tables_list.json` - Available tables list
- `foreign_keys.json` - Foreign key relationships

**Benefits:**
- ✅ Instant loading even after rebuild
- ✅ No need to reprocess data every time
- ✅ Cache persists between restarts
- ✅ Use "🔄 Refresh" button when you need fresh data

**Note:** Cache files are automatically generated on first run and are not committed to git.

## 🔒 Security Notes

- Never commit your `.env` file to version control
- The `.env.example` file is provided as a template
- Ensure your database credentials are kept secure
- Consider using read-only database credentials if you only need to view data

## 🛠️ Technology Stack

- **Backend:** Node.js, Express, PostgreSQL (pg)
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Caching:** File-based JSON storage

## 📝 License

MIT License - feel free to use and modify as needed.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For questions or issues, please open an issue on GitHub.
