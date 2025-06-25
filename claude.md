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

## Important Notes

### Authentication
- The API uses JWT tokens with 24-hour expiry
- Token must be sent in `X-API-Key` header (NOT `Authorization`)
- Authentication endpoint: `/auth/access-token`

### API Endpoints
- BI endpoints (with pagination support):
  - `/dadosVeiculos` - Vehicle BI data
  - `/dadosClientes` - Client BI data
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
- BI tables: `bi_dados_veiculos`, `bi_dados_clientes`
- Regular tables: `clientes`, `condutores`, `veiculos`, `contratos`, `contrato_master`, `reservas`, `formas_pagamento`
- Metadata tables: `sync_metadata`, `sync_audit_log`

### Current Sync Status
- ✅ bi_dados_clientes: 2,848 records synced
- ✅ bi_dados_veiculos: 3,800 records synced
- ✅ veiculos: 20 records synced
- ✅ contratos: 20 records synced
- ✅ formas_pagamento: 112 records synced (was 224, deduped to 112)
- ⚠️ Some endpoints still have rate limiting issues (condutores, contratomaster)
- ⚠️ reservas endpoint returns null data