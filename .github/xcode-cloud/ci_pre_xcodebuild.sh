#!/bin/sh
set -e

echo "🔧 Xcode Cloud Pre-build Script"
echo "================================"

# Navigate to workspace root
cd "$CI_WORKSPACE"
echo "📁 Working directory: $(pwd)"

# Install dependencies
echo "📦 Installing npm dependencies..."
npm ci

# Build React app
echo "🏗️  Building React app..."
npm run build

# Sync Capacitor iOS project
echo "🔄 Syncing Capacitor iOS project..."
npx cap sync ios

echo "✅ Pre-build script completed successfully"
