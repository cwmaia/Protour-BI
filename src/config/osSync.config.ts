export const osSyncConfig = {
  headers: {
    batchSize: 1000,        // Fetch 1000 OS headers at once
    delayMs: 2000,          // 2 second delay between header batches
    maxRetries: 3
  },
  details: {
    batchSize: 5,           // Process 5 details at a time (very conservative)
    delayMs: 10000,         // 10 seconds between detail batches
    maxRetries: 5,
    maxConcurrent: 1        // Sequential processing to avoid rate limits
  },
  rateLimits: {
    requestsPerMinute: 20,  // Very conservative - 20 requests per minute max
    requestsPerHour: 600,   // 600 requests per hour max
    backoffMultiplier: 2,   // Double delay on rate limit
    cooldownMs: 60000       // 1 minute cooldown after rate limit
  },
  incremental: {
    enabled: true,
    lookbackDays: 7,        // Re-sync last 7 days of data
    maxRecordsPerRun: 2000, // Max records per sync run
    resumeEnabled: true     // Allow resuming interrupted syncs
  },
  database: {
    insertBatchSize: 100,   // Insert 100 records at a time to DB
    transactionTimeout: 30000
  }
};