# Protour-Locavia Data Sync Service

## Project Overview
A backend service that synchronizes data from the Locavia API to a local MySQL database for Business Intelligence purposes.

## Goals
1. Reliable data synchronization from Locavia API
2. Maintain up-to-date data for BI analysis
3. Handle API failures gracefully
4. Provide clean, queryable data structure

## Architecture
- **Data Source**: Locavia API (https://apilocavia.infosistemas.com.br:3049)
- **Storage**: MySQL database
- **Sync Method**: Scheduled jobs for each data entity
- **Language**: Node.js/TypeScript (recommended for type safety)

## Key Components
1. **API Client**: Handles authentication and API requests
2. **Data Models**: MySQL schemas matching API entities
3. **Sync Jobs**: Individual jobs for each data type
4. **Scheduler**: Manages job execution timing
5. **Error Handler**: Manages failures and retries

## Data Flow
1. Authenticate with Locavia API
2. Fetch data from various endpoints
3. Transform data if needed
4. Store/update in MySQL
5. Log sync status and metrics

## Integration Points
- **Input**: Locavia REST API
- **Output**: MySQL database for BI tools
- **Monitoring**: Logs and metrics for sync status