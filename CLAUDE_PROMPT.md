# Claude AI Assistant Prompt - Locavia Sync Service

## Project Context

You are helping me develop and maintain the **Locavia Sync Service**, a data synchronization system between Locavia API and MySQL database for Power BI analytics.

**GitHub Repository**: https://github.com/carlosmaia/locavia-sync-service

## Current Project Status

### Environment
- **Development OS**: Windows 11
- **Database**: MySQL 8.0 (local)
- **Node.js**: v18+ 
- **Target**: Power BI Desktop for data visualization
- **API**: Locavia API (https://apilocavia.infosistemas.com.br:3049)

### Database Status (Last Sync: 2025-08-14)
- **Total OS Records**: 20,375 service orders
- **Total Expenses Tracked**: R$ 1,872,740.28 (94% of expected R$ 200k/month)
- **Coverage**: Excellent - achieving target metrics

### Key Achievements
- ✅ Implemented 2.5-second rate limiting for API stability
- ✅ Year-based filtering for efficient Power BI integration
- ✅ 94% expense tracking coverage achieved
- ✅ Cross-platform compatibility (Windows/macOS/Linux)
- ✅ Comprehensive sync orchestration with retry logic

## Technical Stack

### Core Technologies
- **TypeScript**: Primary language
- **MySQL2**: Database driver with connection pooling
- **Axios**: HTTP client with interceptors
- **Express**: REST API server
- **Winston**: Logging system
- **Node-cron**: Scheduled tasks

### Project Structure
```
locavia-sync-service/
├── src/
│   ├── config/          # Database and API configuration
│   ├── services/        # Core services (ApiClient, SyncOrchestrator)
│   ├── scripts/         # Executable sync scripts
│   ├── api/            # REST API server
│   └── utils/          # Logging and utilities
├── dist/               # Compiled JavaScript
└── logs/              # Application logs
```

## Key Features

### 1. Year-Based Sync (Power BI Optimized)
```bash
npm run sync:year -- --year=2024
```
- Syncs one year at a time for manageable datasets
- Optimized for Power BI performance
- Reduces memory usage and sync time

### 2. Rate Limiting Protection
- 2.5-second delay between API calls
- Automatic retry with exponential backoff
- 60-second wait on rate limit (429) errors

### 3. API Authentication
- JWT tokens with 24-hour expiry
- Token sent via `X-API-Key` header (NOT Authorization)
- Automatic token refresh

## Available NPM Scripts

```bash
# Database Setup
npm run db:setup           # Initialize database
npm run db:create-tables   # Create all tables
npm run db:create-os-tables # Create OS-specific tables

# Sync Operations
npm run sync:year          # Sync current year
npm run sync:all           # Sync all entities
npm run sync:entity [name] # Sync specific entity
npm run sync:os            # Basic OS sync
npm run sync:os-complete   # Complete OS sync with details
npm run sync:os-incremental # Incremental OS sync
npm run sync:status        # Check sync status

# Development
npm run dev               # Start in development mode
npm run build            # Build for production
npm run api:start        # Start API server
npm run api:dev          # Start API with auto-reload
```

## API Endpoints (When Server Running)

- `GET /api/sync/status` - Overall sync status
- `GET /api/sync/:entity/status` - Entity-specific status
- `POST /api/sync/:entity/start` - Trigger sync
- `GET /api/data/summary` - Data statistics
- `GET /api/health` - Health check

## Database Schema

### Main BI Tables
- `bi_dados_veiculos` - Vehicle metrics (3,800 records)
- `bi_dados_clientes` - Client metrics (2,848 records)
- `bi_vehicle_expenses` - Aggregated expenses
- `os` - Service orders (20,375 records)
- `os_itens` - Service order details (8,675 records)

### Supporting Tables
- `veiculos` - Vehicle master data
- `clientes` - Client master data
- `contratos` - Contracts
- `formas_pagamento` - Payment methods
- `sync_metadata` - Sync tracking
- `sync_audit_log` - Sync history

## Power BI Integration

### Connection String
```
Server: localhost
Database: locavia_bi
Port: 3306
```

### Recommended Relationships
- `os.codigo_os` → `os_itens.codigo_os`
- `os.placa` → `bi_dados_veiculos.placa`
- `bi_dados_clientes.codigo_cliente` → `clientes.codigo`

### Sample DAX Measures
```dax
// Total Monthly Expenses
Monthly Expenses = 
CALCULATE(
    SUM(os_itens[valor_total_item]),
    DATEINPERIOD(os[data_abertura], MAX(os[data_abertura]), -1, MONTH)
)

// YoY Growth
YoY Growth = 
VAR CurrentYear = CALCULATE(SUM(os_itens[valor_total_item]), YEAR(os[data_abertura]) = YEAR(TODAY()))
VAR PreviousYear = CALCULATE(SUM(os_itens[valor_total_item]), YEAR(os[data_abertura]) = YEAR(TODAY())-1)
RETURN DIVIDE(CurrentYear - PreviousYear, PreviousYear)

// Vehicle Utilization Rate
Utilization Rate = 
DIVIDE(
    COUNTROWS(FILTER(bi_dados_veiculos, [status] = "ACTIVE")),
    COUNTROWS(bi_dados_veiculos)
)
```

## Current Development Focus

### Priorities
1. **Power BI Dashboard Development** - Creating comprehensive visualizations
2. **Performance Optimization** - Query optimization for large datasets
3. **Automated Scheduling** - Windows Task Scheduler integration
4. **Real-time Monitoring** - WebSocket-based sync monitoring

### Known Issues
- Some API endpoints have strict rate limits
- `reservas` endpoint returns null data
- Need to implement incremental sync for all entities

## Common Tasks and Solutions

### Task: Sync Latest Data
```bash
# Windows PowerShell
cd C:\Projects\locavia-sync-service
npm run sync:year
```

### Task: Check Sync Status
```bash
npm run sync:status
```

### Task: Troubleshoot Rate Limiting
```javascript
// Already implemented in src/services/api.client.ts
// 2.5-second delay between requests
// Automatic retry with exponential backoff
```

### Task: Add New Entity Sync
1. Create new sync service in `src/services/sync/`
2. Extend `BaseSyncService`
3. Register in `SyncOrchestrator`
4. Add database table
5. Create npm script

## Environment Variables (.env)

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=bi_user
DB_PASSWORD=your_password
DB_NAME=locavia_bi

# API
API_BASE_URL=https://apilocavia.infosistemas.com.br:3049
API_CNPJ=12801601000182
API_USERNAME=BI
API_PASSWORD=BI2025

# Application
NODE_ENV=production
LOG_LEVEL=info
API_SERVER_PORT=3001
```

## Git Workflow

```bash
# Regular workflow
git status
git add .
git commit -m "feat: description of changes"
git push origin main

# Feature branch
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "feat: new feature implementation"
git push origin feature/new-feature
# Create Pull Request on GitHub
```

## Testing Checklist

Before pushing changes:
- [ ] Run `npm run typecheck`
- [ ] Run `npm run lint`
- [ ] Test sync for one entity
- [ ] Check logs for errors
- [ ] Verify database updates
- [ ] Test Power BI connection

## Performance Tips

1. **Use Year-Based Sync**: Process data year by year
2. **Increase Node Memory**: `NODE_OPTIONS="--max-old-space-size=4096"`
3. **Create Database Indexes**: On frequently queried columns
4. **Use DirectQuery in Power BI**: For real-time data
5. **Schedule Off-Peak Syncs**: Run intensive syncs during night

## Security Reminders

- Never commit `.env` file
- Use environment variables for secrets
- Implement database user permissions
- Regular backup of production data
- Monitor API usage and rate limits

## Contact & Support

- **GitHub Issues**: https://github.com/carlosmaia/locavia-sync-service/issues
- **Documentation**: Check README.md and WINDOWS_SETUP.md
- **Logs**: Review `logs/error.log` for detailed errors

## Quick Reference

### Most Used Commands
```bash
npm run sync:year          # Sync current year
npm run sync:status        # Check status
npm run api:start         # Start API server
npm run build            # Build for production
```

### File Locations
- Config: `src/config/`
- Sync Services: `src/services/sync/`
- Scripts: `src/scripts/`
- Logs: `logs/`

### Database Queries
```sql
-- Check sync status
SELECT * FROM sync_metadata ORDER BY last_sync_at DESC;

-- View expenses by month
SELECT 
    DATE_FORMAT(data_abertura, '%Y-%m') as month,
    SUM(valor_total) as total
FROM os
GROUP BY DATE_FORMAT(data_abertura, '%Y-%m')
ORDER BY month DESC;

-- Check table sizes
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS size_mb
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'locavia_bi'
ORDER BY TABLE_ROWS DESC;
```

---

**Remember**: This is a production system handling financial data. Always test changes thoroughly before deploying. Focus on data accuracy, performance, and Power BI integration.