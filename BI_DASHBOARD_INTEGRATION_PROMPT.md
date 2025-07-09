# BI Dashboard - Protour-Locavia Sync Integration Guide

## Overview
This document provides complete instructions for integrating the Protour-Locavia sync service into your BI dashboard application. The sync service provides REST API endpoints and WebSocket connections for real-time monitoring and control of data synchronization processes.

## Architecture Summary

### Sync Service (This Project)
- **Location**: Protour-Locavia repository
- **Port**: 3050 (configurable via API_PORT environment variable)
- **Technology**: Node.js/TypeScript with Express.js and Socket.io
- **Purpose**: Syncs data from Locavia API to MySQL database for BI analysis

### Available Entities for Sync
1. `bi_dados_clientes` - Client BI data (~2,848 records)
2. `bi_dados_veiculos` - Vehicle BI data (~3,800 records)
3. `clientes` - Client records
4. `veiculos` - Vehicles
5. `contratos` - Contracts
6. `formas_pagamento` - Payment methods
7. `os` - Service Orders (thousands of records with expense details)

## API Endpoints

### Base URL
```
http://localhost:3050/api
```

### 1. Health Check
```http
GET /api/health
```
**Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "authentication": "valid",
    "rateLimit": {
      "available": true,
      "retryAfter": null
    }
  },
  "timestamp": "2025-01-09T10:00:00.000Z"
}
```

### 2. Start Sync Process
```http
POST /api/sync/start
```
**Response:**
```json
{
  "message": "Sync started successfully",
  "status": {
    "isRunning": true,
    "startTime": "2025-01-09T10:00:00.000Z",
    "progress": [],
    "overallProgress": 0,
    "errors": []
  }
}
```

### 3. Stop Sync Process
```http
POST /api/sync/stop
```
**Response:**
```json
{
  "message": "Sync stopped successfully",
  "status": {
    "isRunning": false,
    "endTime": "2025-01-09T10:05:00.000Z"
  }
}
```

### 4. Get Current Sync Status
```http
GET /api/sync/status
```
**Response:**
```json
{
  "isRunning": true,
  "currentEntity": "bi_dados_veiculos",
  "progress": [
    {
      "entity": "bi_dados_clientes",
      "status": "completed",
      "current": 2848,
      "total": 2848,
      "percentage": 100,
      "startTime": "2025-01-09T10:00:00.000Z",
      "endTime": "2025-01-09T10:02:00.000Z"
    },
    {
      "entity": "bi_dados_veiculos",
      "status": "running",
      "current": 1500,
      "total": 3800,
      "percentage": 39,
      "startTime": "2025-01-09T10:02:00.000Z",
      "estimatedTimeRemaining": 120000
    }
  ],
  "overallProgress": 25,
  "startTime": "2025-01-09T10:00:00.000Z",
  "estimatedCompletion": "2025-01-09T10:15:00.000Z",
  "errors": []
}
```

### 5. Get Sync History
```http
GET /api/sync/history
```
**Response:**
```json
[
  {
    "entity_name": "bi_dados_veiculos",
    "sync_start": "2025-01-09T09:00:00.000Z",
    "sync_end": "2025-01-09T09:05:00.000Z",
    "records_synced": 3800,
    "status": "completed",
    "error_message": null
  }
]
```

### 6. Get Entity Statistics
```http
GET /api/stats/:entity
```
**Example:** `GET /api/stats/bi_dados_veiculos`
**Response:**
```json
{
  "total_records": 3800,
  "last_sync": "2025-01-09T09:05:00.000Z",
  "last_sync_count": 3800
}
```

## WebSocket Events

### Connection
```javascript
const socket = io('http://localhost:3050');
```

### Events from Server

#### 1. Sync Status Update
```javascript
socket.on('sync:status', (status) => {
  // Full status object as shown in GET /api/sync/status
});
```

#### 2. Progress Update
```javascript
socket.on('sync:progress', (data) => {
  console.log(data);
  // {
  //   entity: 'bi_dados_veiculos',
  //   progress: {
  //     entity: 'bi_dados_veiculos',
  //     status: 'running',
  //     current: 1500,
  //     total: 3800,
  //     percentage: 39,
  //     estimatedTimeRemaining: 120000
  //   }
  // }
});
```

#### 3. Sync Error
```javascript
socket.on('sync:error', (error) => {
  console.log(error);
  // {
  //   entity: 'condutores',
  //   error: 'Rate limit exceeded'
  // }
});
```

#### 4. Sync Complete
```javascript
socket.on('sync:complete', (finalStatus) => {
  // Full final status with all results
});
```

## Implementation Guide for BI Dashboard

### 1. Install Required Dependencies
```bash
npm install axios socket.io-client
# or
yarn add axios socket.io-client
```

### 2. Create Sync Service Client
```typescript
// services/syncService.ts
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

class SyncService {
  private apiUrl = 'http://localhost:3050/api';
  private socket: Socket;
  
  constructor() {
    this.socket = io('http://localhost:3050');
  }
  
  // Check service health
  async checkHealth() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`);
      return response.data;
    } catch (error) {
      throw new Error('Sync service is not available');
    }
  }
  
  // Start sync process
  async startSync() {
    const response = await axios.post(`${this.apiUrl}/sync/start`);
    return response.data;
  }
  
  // Stop sync process
  async stopSync() {
    const response = await axios.post(`${this.apiUrl}/sync/stop`);
    return response.data;
  }
  
  // Get current status
  async getStatus() {
    const response = await axios.get(`${this.apiUrl}/sync/status`);
    return response.data;
  }
  
  // Subscribe to real-time updates
  onProgress(callback: (data: any) => void) {
    this.socket.on('sync:progress', callback);
  }
  
  onError(callback: (error: any) => void) {
    this.socket.on('sync:error', callback);
  }
  
  onComplete(callback: (status: any) => void) {
    this.socket.on('sync:complete', callback);
  }
  
  // Cleanup
  disconnect() {
    this.socket.disconnect();
  }
}

export default new SyncService();
```

### 3. Create Sync Monitor Component
```tsx
// components/SyncMonitor.tsx
import React, { useState, useEffect } from 'react';
import syncService from '../services/syncService';

const SyncMonitor: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<any[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [errors, setErrors] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    // Check health on mount
    checkHealth();
    
    // Get initial status
    syncService.getStatus().then(status => {
      setIsRunning(status.isRunning);
      setProgress(status.progress);
      setOverallProgress(status.overallProgress);
      setErrors(status.errors);
    });
    
    // Subscribe to real-time updates
    syncService.onProgress((data) => {
      setProgress(prev => {
        const updated = [...prev];
        const index = updated.findIndex(p => p.entity === data.entity);
        if (index >= 0) {
          updated[index] = data.progress;
        } else {
          updated.push(data.progress);
        }
        return updated;
      });
    });
    
    syncService.onError((error) => {
      setErrors(prev => [...prev, error]);
    });
    
    syncService.onComplete((status) => {
      setIsRunning(false);
      setProgress(status.progress);
      setOverallProgress(100);
    });
    
    // Cleanup
    return () => {
      syncService.disconnect();
    };
  }, []);

  const checkHealth = async () => {
    try {
      const healthStatus = await syncService.checkHealth();
      setHealth(healthStatus);
    } catch (error) {
      setHealth({ status: 'unhealthy', error: error.message });
    }
  };

  const handleStartSync = async () => {
    try {
      await syncService.startSync();
      setIsRunning(true);
      setProgress([]);
      setErrors([]);
      setOverallProgress(0);
    } catch (error) {
      alert('Failed to start sync: ' + error.message);
    }
  };

  const handleStopSync = async () => {
    try {
      await syncService.stopSync();
      setIsRunning(false);
    } catch (error) {
      alert('Failed to stop sync: ' + error.message);
    }
  };

  return (
    <div className="sync-monitor">
      <h2>Protour-Locavia Sync Monitor</h2>
      
      {/* Health Status */}
      <div className="health-status">
        <h3>Service Health</h3>
        {health && (
          <div className={`status ${health.status}`}>
            Status: {health.status}
            {health.services && (
              <ul>
                <li>Database: {health.services.database}</li>
                <li>Authentication: {health.services.authentication}</li>
                <li>Rate Limit: {health.services.rateLimit.available ? 'Available' : 'Limited'}</li>
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="controls">
        <button 
          onClick={handleStartSync} 
          disabled={isRunning || health?.status !== 'healthy'}
        >
          Start Sync
        </button>
        <button 
          onClick={handleStopSync} 
          disabled={!isRunning}
        >
          Stop Sync
        </button>
      </div>

      {/* Overall Progress */}
      <div className="overall-progress">
        <h3>Overall Progress: {overallProgress}%</h3>
        <progress value={overallProgress} max="100" />
      </div>

      {/* Individual Entity Progress */}
      <div className="entity-progress">
        <h3>Entity Progress</h3>
        {progress.map(entity => (
          <div key={entity.entity} className={`entity ${entity.status}`}>
            <h4>{entity.entity}</h4>
            <div className="stats">
              <span>Status: {entity.status}</span>
              <span>{entity.current} / {entity.total} records</span>
              <span>{entity.percentage}%</span>
            </div>
            <progress value={entity.percentage} max="100" />
            {entity.estimatedTimeRemaining && (
              <span>ETA: {Math.round(entity.estimatedTimeRemaining / 1000)}s</span>
            )}
          </div>
        ))}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="errors">
          <h3>Errors</h3>
          {errors.map((error, index) => (
            <div key={index} className="error">
              <strong>{error.entity}:</strong> {error.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SyncMonitor;
```

### 4. Styling Example
```css
/* styles/syncMonitor.css */
.sync-monitor {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.health-status .status {
  padding: 10px;
  border-radius: 5px;
  margin: 10px 0;
}

.health-status .status.healthy {
  background-color: #d4edda;
  color: #155724;
}

.health-status .status.unhealthy {
  background-color: #f8d7da;
  color: #721c24;
}

.controls {
  margin: 20px 0;
}

.controls button {
  margin-right: 10px;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}

.controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.overall-progress {
  margin: 20px 0;
}

.overall-progress progress {
  width: 100%;
  height: 30px;
}

.entity-progress .entity {
  margin: 15px 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
}

.entity-progress .entity.completed {
  background-color: #d4edda;
}

.entity-progress .entity.running {
  background-color: #d1ecf1;
}

.entity-progress .entity.error {
  background-color: #f8d7da;
}

.entity-progress progress {
  width: 100%;
  height: 20px;
  margin: 10px 0;
}

.errors {
  margin-top: 20px;
  padding: 15px;
  background-color: #f8d7da;
  border-radius: 5px;
}

.errors .error {
  margin: 5px 0;
}
```

## Starting the Sync Service

### 1. Install Dependencies
```bash
cd Protour-Locavia
npm install
```

### 2. Start the API Server
```bash
npm run api:start
# or for development with auto-reload
npm run api:dev
```

The API server will start on port 3050 (or the port specified in API_PORT environment variable).

## Important Notes

### Rate Limiting
The Locavia API has rate limiting. The sync service handles this automatically with:
- Exponential backoff retry logic
- 429 status code handling
- Automatic pause and resume

### Authentication
- JWT tokens are managed automatically by the sync service
- Tokens expire after 24 hours and are auto-refreshed
- No authentication needed between BI dashboard and sync service

### Database Connection
- The sync service connects directly to the MySQL database
- Ensure the database is accessible from the sync service
- Database credentials are configured in the sync service's .env file

### Error Handling
- All errors are logged and returned in API responses
- WebSocket events provide real-time error notifications
- Check the health endpoint before starting sync

### Performance Considerations
- OS sync can take significant time (thousands of records)
- Each entity is synced sequentially to avoid overwhelming the API
- Progress updates are sent in real-time via WebSocket

## Troubleshooting

### Service Won't Start
1. Check if port 3050 is available
2. Verify database connection settings
3. Ensure all npm dependencies are installed
4. Check logs in the sync service

### Sync Fails Immediately
1. Check health endpoint for service status
2. Verify Locavia API credentials are correct
3. Check for rate limiting (wait and retry)
4. Review error messages in the response

### No Real-time Updates
1. Ensure WebSocket connection is established
2. Check for CORS issues if on different domains
3. Verify firewall allows WebSocket connections
4. Check browser console for errors

## Support
For issues or questions:
1. Check sync service logs
2. Review API response error messages
3. Monitor WebSocket events for detailed error information
4. Verify all services are healthy via health endpoint