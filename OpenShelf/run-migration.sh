#!/bin/bash

# Make the script more robust
set -e

echo "Running Drizzle migration..."

# Get the current database URL
DB_URL=$DATABASE_URL

# Strip protocol part from the URL to get host:port
DB_HOST_PORT=$(echo $DB_URL | sed -r 's|^[^:]+://[^@]+@([^/]+)/.*$|\1|')

# Extract database name from URL
DB_NAME=$(echo $DB_URL | sed -r 's|^[^:]+://[^@]+@[^/]+/([^?]*).*$|\1|')

# Extract username and password from URL
DB_USER=$(echo $DB_URL | sed -r 's|^[^:]+://([^:]+):.*$|\1|')
DB_PASS=$(echo $DB_URL | sed -r 's|^[^:]+://[^:]+:([^@]+)@.*$|\1|')

echo "Creating database tables using Drizzle schema..."

# Use tsx to run a migration script
npx tsx scripts/migrate.ts

echo "Migration completed successfully!"