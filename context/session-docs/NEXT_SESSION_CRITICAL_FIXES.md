# Next Session: Critical Monitor and Sync Issues

## 🔴 Critical Issues to Fix

### 1. Logger Output Overlapping Monitor UI
**Problem**: Process manager logger output is printing directly to terminal and overlapping the blessed UI
```
info: Started sync process for dados_veiculos with PID 20849 {"service":"locavia-sync","timestamp":"2025-06-25 23:42:59"}
```

**Root Cause**: The logger in ProcessManager is using console output which interferes with blessed's terminal control

**Fix Required**:
- Redirect all logger output to files when running in monitor mode
- Suppress console output from child processes
- Use blessed's internal logging mechanism only

### 2. Circular Dependency Error in TokenManager
**Problem**: TokenManager failing with "Cannot read properties of undefined (reading 'getInstance')"
```
TypeError: Cannot read properties of undefined (reading 'getInstance')
    at new TokenManager (/Users/carlosmaia/Protour/Protour-Locavia/src/services/tokenManager.ts:18:32)
```

**Root Cause**: Circular dependency between TokenManager and ApiClient
- TokenManager tries to create ApiClient instance in constructor
- ApiClient imports TokenManager
- This creates a circular reference that fails at runtime

**Fix Required**:
- Remove ApiClient dependency from TokenManager constructor
- Pass ApiClient instance when needed instead of creating it
- OR: Create a separate auth service that both can use

## Immediate Actions for Next Session

### 1. Fix Logger Output in Monitor Mode
```typescript
// In processManager.ts, redirect logger output
const child = spawn('npx', ['ts-node', scriptPath, entity], {
  detached: false,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { 
    ...process.env,
    LOG_SILENT: 'true', // Add flag to suppress console logs
    LOG_FILE_ONLY: 'true' // Force file-only logging
  }
});
```

### 2. Fix Circular Dependency
```typescript
// Option 1: Lazy load ApiClient in TokenManager
private getApiClient(): ApiClient {
  if (!this.apiClient) {
    this.apiClient = ApiClient.getInstance();
  }
  return this.apiClient;
}

// Option 2: Inject ApiClient
static getInstance(apiClient?: ApiClient): TokenManager {
  if (!TokenManager.instance) {
    TokenManager.instance = new TokenManager(apiClient);
  }
  return TokenManager.instance;
}
```

### 3. Update Logger Configuration
```typescript
// Add environment-based logger configuration
const logger = winston.createLogger({
  silent: process.env.LOG_SILENT === 'true',
  transports: process.env.LOG_FILE_ONLY === 'true' 
    ? [new winston.transports.File({ filename: 'sync.log' })]
    : [/* normal transports */]
});
```

## Testing Plan

1. **Test Circular Dependency Fix**:
   ```bash
   npx ts-node src/scripts/testTokenManager.ts
   ```

2. **Test Monitor Without Logger Interference**:
   ```bash
   npm run monitor
   ```

3. **Verify Child Process Logs Go to File**:
   - Check `logs/` directory for process outputs
   - Monitor UI should remain clean

## Expected Outcome

After fixes:
- ✅ Clean monitor UI with no overlapping text
- ✅ All sync processes authenticate properly
- ✅ Logger output redirected to files
- ✅ No circular dependency errors

## Priority Order

1. Fix circular dependency (blocks all syncs)
2. Fix logger output (makes monitor unusable)
3. Test complete sync flow

The monitor is almost perfect - these are the last two issues preventing it from working properly!