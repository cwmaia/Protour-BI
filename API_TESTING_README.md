# API Testing Guide

This guide explains how to test the Sync API before integrating with the BI Dashboard.

## Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Ensure database is set up:
```bash
npm run db:setup
npm run db:create-tables
```

3. Ensure `.env` file has correct credentials:
```
LOCAVIA_API_URL=https://apilocavia.infosistemas.com.br:3049
LOCAVIA_CNPJ=12801601000182
LOCAVIA_USERNAME=BI
LOCAVIA_PASSWORD=BI2025
API_PORT=3050
```

## Starting the API Server

Start the API server in a separate terminal:

```bash
# Production mode
npm run api:start

# Development mode with auto-reload
npm run api:dev
```

The server will start on port 3050 (or the port specified in `API_PORT` environment variable).

## Running Tests

### Basic API Test
Quick test to verify all endpoints are working:

```bash
npm run api:test
```

This test will:
- ✅ Check health endpoint
- ✅ Test sync start/stop functionality
- ✅ Verify status and history endpoints
- ✅ Test entity statistics
- ✅ Validate error handling
- ✅ Check WebSocket availability

### Full Integration Test (with WebSocket events)
Comprehensive test including WebSocket event monitoring:

```bash
npm run api:test:full
```

This includes all basic tests plus:
- WebSocket connection testing
- Real-time event monitoring
- Progress update verification

To include a real sync test (starts actual data sync):
```bash
npm run api:test:full -- --with-sync
```

### Verbose Mode
To see detailed response data:
```bash
npm run api:test -- --verbose
```

## Expected Test Results

### Successful Test Output
```
🚀 Testing Protour-Locavia Sync API

📡 Checking if API server is running...

✅ GET /health - Health check endpoint (200)

📊 Health Status:
   Overall: healthy
   Database: connected
   Authentication: valid
   Rate Limit: Available

🧪 Testing API Endpoints...

✅ GET /sync/status - Get sync status (200)
✅ GET /sync/history - Get sync history (200)
✅ GET /stats/bi_dados_veiculos - Get vehicle statistics (200)
✅ GET /stats/bi_dados_clientes - Get client statistics (200)
✅ GET /stats/os - Get OS statistics (200)
✅ GET /invalid-endpoint - Invalid endpoint returns 404 (404)

🧪 Testing Sync Control Endpoints...

✅ POST /sync/start - Start sync process (200)
   ✓ Sync is running
   Current entity: bi_dados_clientes
   Overall progress: 0%

✅ POST /sync/start - Cannot start sync when already running (409)
✅ POST /sync/stop - Stop sync process (200)
✅ POST /sync/stop - Cannot stop sync when not running (409)

🧪 Testing WebSocket Availability...

✅ WebSocket endpoint is available

📊 Test Summary

Total Tests: 9
Passed: 9
Failed: 0
Success Rate: 100.0%

🔍 API Readiness Checklist:
✅ Health endpoint working
✅ Can start sync
✅ Can stop sync
✅ Can get sync status
✅ Can get sync history
✅ Can get entity stats
✅ Proper error handling
✅ Conflict detection

✅ All tests passed! API is ready for BI Dashboard integration!
```

## Troubleshooting

### API Server Not Running
If you see:
```
❌ API Server is not running!
Please start the API server with: npm run api:start
```

Solution: Start the API server in a separate terminal before running tests.

### Port Already in Use
If the server fails to start:
```bash
# Check what's using port 3050
lsof -i :3050

# Use a different port
API_PORT=3051 npm run api:start
API_PORT=3051 npm run api:test
```

### Database Connection Failed
If health check shows database disconnected:
1. Check MySQL is running
2. Verify database credentials in `.env`
3. Run `npm run db:setup`

### Authentication Invalid
If health check shows authentication invalid:
1. Check Locavia API credentials in `.env`
2. Token may have expired - restart the API server

## Manual Testing with cURL

You can also test endpoints manually:

```bash
# Health check
curl http://localhost:3050/api/health

# Get sync status
curl http://localhost:3050/api/sync/status

# Start sync
curl -X POST http://localhost:3050/api/sync/start

# Stop sync
curl -X POST http://localhost:3050/api/sync/stop

# Get history
curl http://localhost:3050/api/sync/history

# Get entity stats
curl http://localhost:3050/api/stats/bi_dados_veiculos
```

## WebSocket Testing

To test WebSocket connections manually, you can use the browser console:

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3050');

// Listen for events
socket.on('connect', () => console.log('Connected!'));
socket.on('sync:status', (status) => console.log('Status:', status));
socket.on('sync:progress', (data) => console.log('Progress:', data));
socket.on('sync:error', (error) => console.log('Error:', error));
socket.on('sync:complete', (status) => console.log('Complete:', status));
```

## Next Steps

Once all tests pass:
1. Keep the API server running
2. Implement the integration in your BI Dashboard using the code from `BI_DASHBOARD_INTEGRATION_PROMPT.md`
3. Test the integration from the BI Dashboard
4. Monitor the sync process in real-time