#!/bin/bash

# Test Push Notification Script
# Usage: ./test-push.sh YOUR_JWT_TOKEN

if [ -z "$1" ]; then
  echo "❌ Error: JWT token required"
  echo "Usage: ./test-push.sh YOUR_JWT_TOKEN"
  echo ""
  echo "To get your JWT token:"
  echo "1. Open your app in browser"
  echo "2. Open Developer Tools (F12 or Cmd+Option+I)"
  echo "3. Go to Console tab"
  echo "4. Type: localStorage.getItem('token')"
  echo "5. Copy the token and use it here"
  exit 1
fi

TOKEN=$1
API_URL="${REACT_APP_API_BASE_URL:-http://localhost:5001}/api/admin/test-push-notification"

echo "🧪 Testing push notification..."
echo "📡 Sending to: $API_URL"
echo ""

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test Push Notification",
    "body": "This is a test notification from the backend!"
  }' \
  -w "\n\nStatus: %{http_code}\n"

echo ""
echo "✅ Done! Check your iPhone for the notification."

