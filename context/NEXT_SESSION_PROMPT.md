# Next Session Implementation Prompt

## Context
We have successfully implemented a Locavia API to MySQL sync service for BI purposes. The service currently syncs vehicle data, client data, contracts, and payment methods. However, we're missing a critical piece: vehicle expenses (OS - Ordem de Serviço/Service Orders).

## Current State
- ✅ 6,800+ records synced across 5 tables
- ✅ Authentication working with X-API-Key header
- ✅ Rate limiting and error handling implemented
- ✅ BI tables optimized for analytics
- ❌ Missing vehicle expense data (OS)

## Task: Implement OS (Vehicle Expenses) Sync

### Requirements
1. **Create Database Schema**:
   ```sql
   -- OS table for service orders
   -- OS_itens table for line items
   -- bi_vehicle_expenses for aggregated data
   ```

2. **Implement OsSyncService**:
   - Fetch from `/os` endpoint (supports pagination)
   - For each OS, fetch details from `/os/{id}` to get items
   - Handle rate limiting between detail fetches

3. **Data Correlation**:
   - Link expenses to vehicles using `placa` (license plate)
   - Calculate total expenses per vehicle
   - Store both detailed and aggregated data

4. **BI Integration**:
   - Create bi_vehicle_expenses table with aggregated metrics
   - Consider adding expense summary columns to bi_dados_veiculos
   - Enable expense trend analysis and ROI calculations

### Technical Details
- OS endpoint supports `pagina` and `linhas` pagination
- Each OS has items array only available in detail endpoint
- Must correlate with vehicles using placa field
- Need to handle potentially missing vehicle matches

### Expected Deliverables
1. Database migration script for OS tables
2. OsSyncService implementation
3. Expense aggregation logic
4. Updated sync orchestrator
5. Testing to verify expense calculations
6. Documentation updates

### Key Code Locations
- Database schemas: `src/scripts/database-schema.sql`
- Sync services: `src/services/sync/`
- Type definitions: `src/types/api.types.ts`
- Endpoint config: `src/config/endpoints.ts`

### Success Criteria
- All OS records and items synced
- Expenses correctly linked to vehicles
- Aggregated expense data available for BI
- Performance optimized for analytics queries
- Zero data loss during sync process

Please implement this critical missing piece to complete our BI data pipeline. The expense data is essential for calculating vehicle ROI and total cost of ownership.