# iOS Simulator API Setup Guide

## The Problem

When running your app in the iOS Simulator, `localhost` refers to the simulator itself, not your Mac. This means API calls to `http://localhost:5001/api` will fail because the simulator can't reach your backend server running on your Mac.

## Solution: Use Your Mac's IP Address

### Step 1: Find Your Mac's Local IP Address

Run this command in Terminal:

```bash
ipconfig getifaddr en0
```

Or check:
- **System Preferences** → **Network** → Select your active connection → Look for "IP Address"

Common formats:
- `192.168.1.100`
- `192.168.0.50`
- `10.0.0.5`

### Step 2: Create a `.env` File

In your project root (`/Users/jadeclement/UoftTriathlon/`), create a `.env` file:

```bash
# Replace 192.168.1.100 with YOUR Mac's IP address
REACT_APP_API_BASE_URL=http://192.168.1.100:5001/api
```

**Important:** Replace `192.168.1.100` with the IP address you found in Step 1!

### Step 3: Make Sure Your Backend is Running

Your backend server should be running on port 5001:

```bash
cd backend
npm start
# or
node server.js
```

### Step 4: Rebuild and Sync

After creating/updating the `.env` file:

```bash
# Rebuild the React app (this reads the .env file)
npm run build

# Sync with Capacitor
npx cap sync ios
```

### Step 5: Test in Simulator

1. Open Xcode: `npm run cap:open:ios`
2. Run the app in the simulator
3. Try logging in - it should now work!

## Alternative: Use ngrok for Testing

If your IP address changes frequently, you can use ngrok:

1. Install ngrok: `brew install ngrok`
2. Start your backend: `cd backend && npm start`
3. In another terminal, run: `ngrok http 5001`
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. In `.env`, set: `REACT_APP_API_BASE_URL=https://abc123.ngrok.io/api`
6. Rebuild and sync

## Troubleshooting

### Still getting "incorrect username/password"?

1. **Check your backend is running:**
   ```bash
   curl http://localhost:5001/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test"}'
   ```

2. **Verify the IP address is correct:**
   - Make sure you're using your Mac's IP, not `localhost`
   - Make sure your Mac and simulator are on the same network

3. **Check the `.env` file:**
   - Make sure it's in the project root
   - Make sure there are no extra spaces
   - Restart your build process after creating/editing `.env`

4. **Check Xcode console for errors:**
   - Look for network errors or CORS issues
   - Check if the API URL is being used correctly

### IP Address Changed?

If your Mac's IP address changes (common on WiFi), just update the `.env` file and rebuild:

```bash
# Update .env with new IP
# Then rebuild
npm run build
npx cap sync ios
```
