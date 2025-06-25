# Protour-Locavia Data Sync Service

A robust data synchronization service that fetches data from the Locavia API and stores it in a MySQL database for Business Intelligence purposes.

## Features

- **Automatic Authentication**: Handles JWT token authentication with X-API-Key header
- **Scheduled Sync**: Configurable sync intervals with cron-based scheduling
- **Pagination Support**: Efficiently handles large datasets with automatic pagination
- **Rate Limiting Protection**: Adaptive rate limiting with exponential backoff
- **Visual Progress Tracking**: Real-time progress bars for sync monitoring
- **Error Handling**: Comprehensive error recovery and logging
- **BI Optimized**: Database schema designed for analytical queries
- **Monitoring**: Sync status tracking and detailed audit logging

## Prerequisites

- Node.js 16+ 
- MySQL 8.0+
- Locavia API credentials

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Protour-Locavia
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# API Configuration
API_BASE_URL=https://apilocavia.infosistemas.com.br:3049/v1
API_CNPJ=12801601000182
API_USERNAME=BI
API_PASSWORD=BI2025

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=locavia_bi

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info
SYNC_INTERVAL_MINUTES=60
TOKEN_REFRESH_HOURS=20
```

5. Set up the database:
```bash
npm run db:setup
npm run db:create-tables
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Sync Operations
```bash
# Sync all entities
npm run sync:all

# Sync with visual progress (parallel)
npm run sync:parallel

# Sync with rate limiting (recommended)
npm run sync:batched

# Sync specific entity
npm run sync:entity dados_veiculos

# Check sync status
npm run sync:status

# Test API endpoints
npm run sync:test-endpoints
```

### Testing
```bash
npm test
npm run test:coverage
```

### Linting
```bash
npm run lint
npm run typecheck
```

## Architecture

### Core Components

1. **API Client** (`src/services/api.client.ts`)
   - Handles authentication and token refresh
   - Implements retry logic with exponential backoff
   - Provides pagination support

2. **Sync Services** (`src/services/sync/`)
   - `BaseSyncService`: Abstract base class for all sync services
   - `DadosVeiculosSyncService`: Syncs vehicle BI data
   - `DadosClientesSyncService`: Syncs client BI data

3. **Sync Orchestrator** (`src/services/sync.orchestrator.ts`)
   - Manages all sync services
   - Provides sync status and history

4. **Scheduler** (`src/services/scheduler.ts`)
   - Cron-based scheduling
   - Health checks
   - Manual sync triggers

### Database Schema

The database is optimized for BI workloads with:
- Indexed columns for common queries
- Denormalized tables for faster reads
- Sync metadata tracking
- Audit logging

Key tables:
- `bi_dados_veiculos`: Vehicle BI data
- `bi_dados_clientes`: Client BI data
- `bi_clientes`: Client master data
- `bi_veiculos`: Vehicle master data
- `bi_contratos`: Contracts data
- `sync_metadata`: Sync status tracking
- `sync_audit_log`: Detailed sync history

## API Endpoints

### Working Endpoints
- `/dadosVeiculos` - Vehicle BI data (✅ 3,800 records synced)
- `/dadosClientes` - Client BI data (✅ 2,848 records synced)
- `/clientes` - Client records
- `/condutores` - Driver records (⚠️ rate limiting)
- `/contratomaster` - Master contracts (⚠️ rate limiting)
- `/veiculos` - Vehicles (✅ 20 records synced)
- `/reservas` - Reservations (⚠️ returns null)
- `/contrato` - Contracts (✅ 20 records synced)
- `/formaPagamento` - Payment methods (✅ 112 records synced)

### Fixed Endpoint Issues
- `/contratos` → `/contrato` (singular)
- `/formaspagamento` → `/formaPagamento` (camelCase)
- Regular endpoints don't support pagination parameters

**Note**: The API uses JWT tokens that must be sent in the `X-API-Key` header, not the `Authorization` header.

## Monitoring

Check sync status:
```bash
# View current sync status
npm run sync:status

# Detailed database status
npx ts-node src/scripts/checkDataStatus.ts
```

SQL queries for monitoring:
```sql
-- Check sync status
SELECT * FROM sync_metadata ORDER BY last_sync_at DESC;

-- View recent sync history
SELECT * FROM sync_audit_log ORDER BY started_at DESC LIMIT 20;

-- Check data counts
SELECT TABLE_NAME, TABLE_ROWS 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'locavia_bi' AND TABLE_ROWS > 0;
```

## Error Handling

- Automatic retry with exponential backoff
- Comprehensive error logging to `logs/error.log`
- Failed sync status tracking in database
- Health checks every 5 minutes

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Set environment variables for production
3. Use a process manager like PM2:
```bash
pm2 start dist/index.js --name locavia-sync
```

4. Set up log rotation for the `logs/` directory

## Troubleshooting

### Authentication Issues
- Check API credentials in `.env`
- Ensure token is sent in `X-API-Key` header (NOT `Authorization`)
- Verify token expiry settings (24-hour expiry)
- Check `logs/error.log` for details

### Rate Limiting (429 Errors)
- Use `npm run sync:batched` for controlled syncing
- Increase delays between requests
- Check API rate limits with provider

### Database Connection Issues
- Verify MySQL is running
- Check database credentials
- Ensure database exists: `CREATE DATABASE locavia_bi`

### Sync Failures
- Check `sync_metadata` table for error messages
- Review `logs/combined.log` for detailed errors
- Verify API endpoint availability

## Current Status

- ✅ Database setup complete
- ✅ Authentication working with X-API-Key header
- ✅ BI endpoints syncing successfully
- ✅ Visual progress tracking implemented
- ✅ Rate limiting protection added
- ⚠️ Some regular endpoints have issues (404s, rate limits)

## License

Private - Protour Internal Use Only