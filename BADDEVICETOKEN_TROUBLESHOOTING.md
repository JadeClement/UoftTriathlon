# BadDeviceToken Error Troubleshooting Guide

If you're getting `BadDeviceToken` errors when sending push notifications, follow these steps:

## Step 1: Verify APNs Key Configuration in Apple Developer Portal

**This is the most common cause!**

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
2. Find your APNs key (the one with Key ID matching `APNS_KEY_ID`)
3. **Verify it has "Apple Push Notifications service (APNs)" enabled**
   - If it doesn't, you need to create a NEW key with APNs enabled
   - Old keys cannot be modified - you must create a new one
4. Download the new `.p8` file if you created a new key
5. Update `APNS_KEY_BASE64` in Vercel with the new key (base64 encoded)

## Step 2: Verify App ID Has Push Notifications Enabled

1. Go to [Apple Developer Portal > Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Find your App ID: `uofttri.club.app`
3. Click on it to edit
4. **Verify "Push Notifications" is checked/enabled**
5. If not, enable it and click Save

## Step 3: Verify APNs Environment Setting

- **For Xcode development builds**: `APNS_PRODUCTION=false` ✅ (you have this)
- **For App Store/TestFlight builds**: `APNS_PRODUCTION=true`

Check your Vercel logs - you should see:
```
📱 APNs provider config: {
  production: false,
  note: 'Using DEVELOPMENT APNs gateway (for Xcode builds)'
}
```

If you see `production: true`, that's the problem!

## Step 4: Verify Bundle ID Matches Exactly

- Backend: `APNS_BUNDLE_ID=uofttri.club.app`
- Xcode: Check `PRODUCT_BUNDLE_IDENTIFIER` in project settings
- Apple Developer Portal: App ID should be `uofttri.club.app`

All three must match **exactly** (case-sensitive).

## Step 5: Delete Old Token and Get Fresh One

1. Delete the old token from database:
   ```sql
   DELETE FROM push_device_tokens WHERE user_id = 3 AND platform = 'ios';
   ```

2. On your iPhone:
   - Force quit the app
   - Log out
   - Log back in
   - This will register a fresh token

3. Verify the new token is saved:
   ```sql
   SELECT token, platform, created_at FROM push_device_tokens WHERE user_id = 3;
   ```

4. The token should be exactly 64 hex characters (no spaces, all lowercase)

## Step 6: Check Xcode Provisioning Profile

1. In Xcode, go to **Signing & Capabilities**
2. Verify **Push Notifications** capability is added
3. Check that your provisioning profile includes Push Notifications
4. If not, you may need to:
   - Remove and re-add the Push Notifications capability
   - Let Xcode regenerate the provisioning profile

## Step 7: Verify Token Format

The token should be:
- Exactly 64 characters
- Hexadecimal (0-9, a-f)
- All lowercase
- No spaces or special characters

Check the database:
```sql
SELECT 
  token, 
  LENGTH(token) as token_length,
  platform 
FROM push_device_tokens 
WHERE user_id = 3 AND platform = 'ios';
```

## Step 8: Test with APNs Provider Directly

If all else fails, you can test the APNs connection directly. The backend logs should show:
- `✅ APNs initialized`
- `📱 APNs provider config: { production: false, ... }`

If you see errors during initialization, that's the problem.

## Common Issues Summary

| Issue | Solution |
|-------|----------|
| APNs key doesn't have APNs enabled | Create new key with APNs enabled in Developer Portal |
| App ID doesn't have Push Notifications | Enable Push Notifications in App ID settings |
| Wrong APNs environment | Set `APNS_PRODUCTION=false` for Xcode builds |
| Bundle ID mismatch | Verify all three places match exactly |
| Old/invalid token | Delete from DB and get fresh token |
| Token format wrong | Should be 64 hex chars, all lowercase |

## Still Not Working?

If you've checked all of the above and it's still not working:

1. **Check Vercel logs** for the full error details
2. **Verify the APNs key file** - make sure it's the correct one and not corrupted
3. **Try creating a completely new APNs key** in Apple Developer Portal
4. **Verify your Apple Developer account** is active and in good standing
5. **Check Apple's system status** - APNs might be having issues

## Next Steps After Fixing

Once it's working:
1. Test with multiple devices
2. Test with different notification types
3. Set up production APNs for App Store builds
4. Document your working configuration

