# Protour-Locavia Sync Service

## Project Rules
1. **NEVER** create files unless absolutely necessary
2. **ALWAYS** prefer editing existing files
3. **NEVER** create documentation files unless explicitly requested
4. Follow clean code principles
5. Implement comprehensive error handling
6. Write tests for critical functionality
7. Use TypeScript for type safety
8. Follow REST API best practices

## Quick Overview
Service that syncs data from Locavia API to MySQL for BI analysis.

## Key Commands
```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Type checking
npm run typecheck

# Database setup
npm run db:setup
npm run db:create-tables
npm run db:status

# Sync operations
npm run sync:all          # Sync all entities
npm run sync:parallel     # Sync entities in parallel
npm run sync:batched      # Sync with rate limiting
npm run sync:entity [name] # Sync specific entity
npm run sync:status       # Check sync status
npm run sync:test-endpoints # Test API endpoints
npm run sync:os           # Sync OS (Service Orders) data
npm run sync:os-test      # Test OS pagination capabilities
npm run sync:os-complete  # Sync ALL OS records with progress tracking

# Check data status
npx ts-node src/scripts/checkDataStatus.ts
```

## API Credentials
- CNPJ: 12801601000182
- Username: BI
- Password: BI2025
- Base URL: https://apilocavia.infosistemas.com.br:3049

## Database
- Engine: MySQL
- Purpose: BI data warehouse
- Design: Optimized for analytical queries

## Sync Monitor Dashboard (Next Session Implementation)

### Purpose
Real-time monitoring and control of sync processes with visibility into:
- Active sync status for each entity
- Progress bars with record counts
- Total expenses tracked vs expected (~R$ 200,000/month)
- Rate limiting and error tracking
- Interactive controls to start/stop syncs

### Commands (To Be Implemented)
```bash
npm run monitor     # Launch interactive sync dashboard
```

### Dashboard Features
- Number key shortcuts (1-7) for sync control
- Real-time progress tracking
- Activity log with rate limit notifications
- Expense tracking vs expectations
- Background process management

## Important Notes

### Authentication
- The API uses JWT tokens with 24-hour expiry
- Token must be sent in `X-API-Key` header (NOT `Authorization`)
- Authentication endpoint: `/auth/access-token`

### API Endpoints
- BI endpoints (with pagination support):
  - `/dadosVeiculos` - Vehicle BI data
  - `/dadosClientes` - Client BI data
- OS endpoint (with pagination support):
  - `/os` - Service orders (supports pagina/linhas params)
- Regular endpoints (limited or no pagination):
  - `/clientes` - Client records
  - `/condutores` - Driver records
  - `/contratomaster` or `/contratoMaster` - Master contracts
  - `/veiculos` - Vehicles (no pagination params)
  - `/reservas` - Reservations (no pagination params)

### Rate Limiting
- API has rate limiting (429 errors)
- Implemented exponential backoff with retry logic
- Use `npm run sync:batched` for controlled syncing

### Database Tables
- BI tables: `bi_dados_veiculos`, `bi_dados_clientes`, `bi_vehicle_expenses`
- Regular tables: `clientes`, `condutores`, `veiculos`, `contratos`, `contrato_master`, `reservas`, `formas_pagamento`
- OS tables: `os`, `os_itens` (vehicle service orders and expenses)
- Metadata tables: `sync_metadata`, `sync_audit_log`

### Current Sync Status
- ✅ bi_dados_clientes: 2,848 records synced
- ✅ bi_dados_veiculos: 3,800 records synced
- ✅ veiculos: 20 records synced
- ✅ contratos: 20 records synced
- ✅ formas_pagamento: 112 records synced (was 224, deduped to 112)
- ⚠️ os: 100 records fetched (out of potentially thousands)
- ❌ CRITICAL: Only tracking R$ 5,476 in expenses vs expected ~R$ 200,000/month
- ✅ FIXED: OS endpoint now properly supports pagination
- ✅ NEW: Added sync:os-complete command to fetch ALL OS records
- ⚠️ Some endpoints still have rate limiting issues (condutores, contratomaster)
- ⚠️ reservas endpoint returns null data
- ⚠️ OS detail fetching requires careful rate limiting (500ms between requests)