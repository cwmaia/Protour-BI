# OS Sync Action Plan

## Current Situation
- **API Status**: Currently DOWN (500 errors - database connection issues)
- **Data Captured**: Only 100 OS records (14.1% of expected expenses)
- **Expected**: ~R$ 200,000/month in expenses
- **Actual**: R$ 28,257 captured so far

## Immediate Actions When API Recovers

### 1. Check API Health
```bash
npm run check:api-health
```
Wait until all endpoints show green checks.

### 2. Review Current Status
```bash
npm run check:os-status
```
Verify current database state before syncing.

### 3. Run Optimized Sync

#### Option A: Balanced Strategy (Recommended)
```bash
npm run sync:os-optimized -- --strategy balanced
```
- Fetches all details with smart batching
- ~15-20 minutes for 10k records
- Best balance of speed and completeness

#### Option B: Fast Strategy (Headers Only)
```bash
npm run sync:os-optimized -- --strategy fast
```
- Only basic OS data, no item details
- ~3-5 minutes for 10k records
- Use for quick overview

#### Option C: Detailed Strategy (Unstable API)
```bash
npm run sync:os-optimized -- --strategy detailed
```
- Maximum retries and conservative delays
- ~50-60 minutes for 10k records
- Use when API is unstable

### 4. Monitor Progress
```bash
npm run monitor
```
- Press [3] to start OS sync from dashboard
- Real-time progress tracking
- Clean UI without logger interference

## Troubleshooting

### If Sync Fails
1. Check API health: `npm run check:api-health`
2. Review logs: `tail -f logs/combined.log`
3. Check rate limits in monitor dashboard
4. Switch to 'detailed' strategy if needed

### If Still Missing Expenses
1. The API might not have all historical data
2. Check date ranges in `npm run check:os-status`
3. Verify with Locavia support if data exists

## Success Criteria
- [ ] OS records count in thousands (not hundreds)
- [ ] Total expenses approaching R$ 200,000/month
- [ ] All vehicles have associated expenses
- [ ] Sync completes without errors

## Next Steps After Successful Sync
1. Set up scheduled syncs (daily/weekly)
2. Monitor expense trends
3. Create alerts for sync failures
4. Document actual vs expected expenses

The optimized sync service is ready to capture all OS data once the API stabilizes.