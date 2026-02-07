#!/bin/bash
set -e

echo "🚀 Getting Real YouTube Data - Run this script!"
echo ""

# Step 1: Check YouTube API Key
echo "📋 Step 1: Checking YouTube API Key..."
if grep -q "YOUTUBE_API_KEY=$" .env.local || ! grep -q "YOUTUBE_API_KEY=" .env.local; then
    echo "❌ ERROR: YouTube API Key not set!"
    echo ""
    echo "👉 ACTION REQUIRED:"
    echo "1. Go to: https://console.cloud.google.com/apis/credentials"
    echo "2. Create an API Key for YouTube Data API v3"
    echo "3. Edit .env.local and add:"
    echo "   YOUTUBE_API_KEY=AIzaSy_your_actual_key_here"
    echo ""
    echo "Then run this script again!"
    exit 1
else
    echo "✅ YouTube API Key found"
fi

# Step 2: Push Database Schema
echo ""
echo "📋 Step 2: Pushing database schema..."
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dabbleverse" npm run db:push
echo "✅ Database schema pushed"

# Step 3: Seed YouTube Channels
echo ""
echo "📋 Step 3: Seeding YouTube channels..."
npm run seed:youtube
echo "✅ Channels seeded"

# Step 4: Instructions for Worker
echo ""
echo "📋 Step 4: Start the worker (in a NEW terminal):"
echo ""
echo "   npm run worker:dev"
echo ""
echo "Keep that terminal open and watch the logs!"
echo ""

# Step 5: Timeline
echo "⏰ TIMELINE:"
echo "  Minute 0-5:   Resolving 9 YouTube channels"
echo "  Minute 10-15: Ingesting 150+ videos"
echo "  Minute 20-25: Deduplicating into events"
echo "  Minute 25-30: Building feed cards"
echo "  Minute 30:    ✅ REAL DATA LIVE!"
echo ""
echo "📊 Check progress:"
echo "  npm run db:studio   (opens database viewer)"
echo "  curl 'http://localhost:3000/api/feed?window=now' | jq"
echo ""
echo "🎉 Done! Now start the worker in a new terminal:"
echo "   npm run worker:dev"
