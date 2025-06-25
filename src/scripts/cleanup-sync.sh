#!/bin/bash

# Cleanup Sync Metadata Script
# This script removes duplicate entries in sync_metadata table and resets all statuses

echo "🚀 Running sync metadata cleanup..."
echo ""

# Run the TypeScript cleanup script
npx ts-node src/scripts/cleanupSyncMetadata.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Cleanup completed successfully!"
else
    echo ""
    echo "❌ Cleanup failed. Please check the logs."
    exit 1
fi