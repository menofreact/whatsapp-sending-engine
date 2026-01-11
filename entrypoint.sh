#!/bin/bash
set -e

# Fix permissions for data directories
# We need this because Docker volumes often mount as root on VPS
echo "Fixing permissions for data directories..."
chown -R appuser:appuser /app/db /app/uploads /app/.wwebjs_auth

# Switch to 'appuser' and run the command
exec gosu appuser "$@"
