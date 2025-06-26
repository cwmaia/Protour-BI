# OS Sync Rate Limiting Strategy

## Current Situation
- **Total OS Records**: 100
- **OS with items fetched**: 20 (20%)
- **Total items**: 56
- **Vehicles with expenses**: 20 (8 with value > 0)
- **Total expenses tracked**: R$ 5,476.04

## Issues Identified
1. **API Rate Limiting**: 429 errors after ~5-10 requests
2. **Zero-value items**: Many OS items have valor_item = 0
3. **Incomplete data**: 80 OS records still need detail fetching

## Rate Limiting Strategy

### 1. Batch Processing Approach
```
BATCH_SIZE = 3 records
DELAY_BETWEEN_REQUESTS = 2 seconds
DELAY_BETWEEN_BATCHES = 10 seconds
MAX_RETRIES = 3 with exponential backoff
```

### 2. Scheduled Sync Process
Instead of trying to fetch all at once, implement a scheduled approach:

#### Phase 1: Initial Basic Sync
```bash
npm run sync:os  # Gets OS headers only
```

#### Phase 2: Gradual Detail Fetching
```bash
# Run multiple times throughout the day
npx ts-node src/scripts/fetchRemainingOsDetails.ts
```

#### Phase 3: Expense Aggregation
```bash
npx ts-node src/scripts/updateVehicleExpenses.ts
```

### 3. Implementation Scripts

#### A. Check Current Status
```bash
npx ts-node src/scripts/checkOsData.ts
npx ts-node src/scripts/checkVehicleExpenses.ts
```

#### B. Fetch Details with Rate Limiting
- `fetchOsDetails.ts` - Fetches first 20 with conservative limits
- `fetchRemainingOsDetails.ts` - Continues fetching with retry logic

#### C. Update Aggregations
The scripts automatically update bi_vehicle_expenses after fetching

### 4. Monitoring Progress
Track progress through:
- OS records with quantidade_itens > 0
- Items in os_itens table
- Records in bi_vehicle_expenses

### 5. Handling Rate Limits
When hitting 429 errors:
1. First retry: Wait 60 seconds
2. Second retry: Wait 120 seconds
3. Third retry: Wait 180 seconds
4. If still failing: Stop and retry later

### 6. Recommended Schedule
For production deployment:
```
00:00 - Run basic OS sync
02:00 - Fetch details batch 1 (25 records)
08:00 - Fetch details batch 2 (25 records)
14:00 - Fetch details batch 3 (25 records)
20:00 - Fetch details batch 4 (25 records)
23:00 - Update expense aggregations
```

### 7. SQL Queries for Monitoring

Check sync progress:
```sql
SELECT 
  COUNT(*) as total_os,
  SUM(CASE WHEN quantidade_itens > 0 THEN 1 ELSE 0 END) as os_with_details,
  SUM(quantidade_itens) as total_items,
  SUM(valor_total) as total_value
FROM os;
```

Check expense distribution:
```sql
SELECT 
  COUNT(*) as vehicles_count,
  SUM(total_expenses) as total_expenses,
  AVG(total_expenses) as avg_expense,
  MAX(total_expenses) as max_expense
FROM bi_vehicle_expenses
WHERE total_expenses > 0;
```

### 8. Error Recovery
If sync fails partially:
1. The scripts track which OS have been processed (quantidade_itens > 0)
2. Restart will skip already processed records
3. bi_vehicle_expenses updates are idempotent

### 9. Production Considerations
- Use environment variable for delays: `OS_SYNC_DELAY_MS`
- Log all 429 errors for pattern analysis
- Consider implementing adaptive rate limiting
- Monitor API response times to predict rate limits

### 10. Next Steps
1. Complete fetching remaining 80 OS details
2. Investigate zero-value items with business team
3. Create automated scheduler for continuous sync
4. Implement incremental sync for new OS records
5. Add alerts for sync failures

## Commands Summary

```bash
# Check current status
npm run sync:status
npx ts-node src/scripts/checkOsData.ts

# Fetch OS details gradually
npx ts-node src/scripts/fetchRemainingOsDetails.ts

# Check results
npx ts-node src/scripts/checkVehicleExpenses.ts

# Run tests
npm test -- os.sync.test.ts
```

This strategy ensures reliable OS sync despite API rate limitations while maintaining data integrity and providing visibility into vehicle expenses.