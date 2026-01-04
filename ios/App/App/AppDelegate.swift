import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    // Store token in case it arrives before plugin is ready
    static var storedDeviceToken: Data?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        print("📱 AppDelegate: Application launching")
        return true
    }
    
    // MARK: - Push Notification Registration
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Convert device token to string for logging
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        print("📱 AppDelegate: Device token received: \(token)")
        print("📱 AppDelegate: Device token data length: \(deviceToken.count) bytes")
        
        // Store token in case plugin isn't ready yet
        AppDelegate.storedDeviceToken = deviceToken
        
        // Forward to Capacitor's Push Notifications plugin
        // Method 1: NotificationCenter (standard Capacitor approach)
        NotificationCenter.default.post(
            name: NSNotification.Name("capacitorDidRegisterForRemoteNotifications"),
            object: deviceToken
        )
        print("📱 AppDelegate: Posted 'capacitorDidRegisterForRemoteNotifications' notification")
        
        // Method 2: Also try with userInfo
        NotificationCenter.default.post(
            name: NSNotification.Name("capacitorDidRegisterForRemoteNotifications"),
            object: nil,
            userInfo: ["deviceToken": deviceToken]
        )
        
        // Method 3: Try direct JavaScript injection as fallback
        // Wait a bit for Capacitor to be ready, then inject token directly
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            if let bridge = self.window?.rootViewController as? CAPBridgeViewController {
                let tokenString = token
                print("📱 AppDelegate: Attempting direct JavaScript injection with token: \(tokenString.prefix(20))...")
                
                // Escape the token string for JavaScript
                let escapedToken = tokenString.replacingOccurrences(of: "\\", with: "\\\\")
                    .replacingOccurrences(of: "'", with: "\\'")
                
                // Try to manually trigger the registration event
                // Use multiple methods to ensure it works
                let jsCode = """
                    (function() {
                        console.log('📱 AppDelegate: Injecting token via JavaScript');
                        const token = '\(escapedToken)';
                        console.log('📱 Token to inject:', token.substring(0, 20) + '...');
                        
                        // Method 1: Dispatch custom event FIRST (most reliable)
                        try {
                            const event = new CustomEvent('pushNotificationRegistration', {
                                detail: { value: token },
                                bubbles: true,
                                cancelable: true
                            });
                            window.dispatchEvent(event);
                            document.dispatchEvent(event); // Also try on document
                            console.log('✅ Method 1: Custom event dispatched to window and document');
                        } catch (e) {
                            console.log('❌ Method 1 error:', e);
                        }
                        
                        // Method 2: Try Capacitor plugin notifyListeners
                        try {
                            if (window.Capacitor && window.Capacitor.Plugins) {
                                const plugin = window.Capacitor.Plugins.PushNotifications;
                                if (plugin) {
                                    if (plugin.notifyListeners) {
                                        plugin.notifyListeners('registration', { value: token });
                                        console.log('✅ Method 2: notifyListeners called');
                                    } else {
                                        console.log('⚠️ Method 2: notifyListeners not available');
                                    }
                                } else {
                                    console.log('⚠️ Method 2: PushNotifications plugin not found');
                                }
                            }
                        } catch (e) {
                            console.log('❌ Method 2 error:', e);
                        }
                        
                        // Method 3: Try global function if it exists
                        try {
                            if (typeof window.handlePushToken === 'function') {
                                window.handlePushToken(token);
                                console.log('✅ Method 3: Global handler called');
                            }
                        } catch (e) {
                            console.log('❌ Method 3 error:', e);
                        }
                        
                        console.log('📱 All injection methods attempted for token:', token.substring(0, 20) + '...');
                    })();
                """
                
                bridge.webView?.evaluateJavaScript(jsCode, completionHandler: { (result, error) in
                    if let error = error {
                        print("❌ AppDelegate: JavaScript injection error: \(error.localizedDescription)")
                    } else {
                        print("📱 AppDelegate: JavaScript injection completed")
                    }
                })
            } else {
                print("⚠️ AppDelegate: CAPBridgeViewController not found, cannot inject token")
            }
        }
        
        print("📱 AppDelegate: Token forwarding complete")
    }
    
    // Helper method to re-emit stored token (can be called from plugin when ready)
    static func reEmitStoredToken() {
        if let token = storedDeviceToken {
            print("📱 AppDelegate: Re-emitting stored token")
            NotificationCenter.default.post(
                name: NSNotification.Name("capacitorDidRegisterForRemoteNotifications"),
                object: token
            )
        }
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("❌ AppDelegate: Failed to register for remote notifications: \(error.localizedDescription)")
        print("❌ AppDelegate: Error details: \(error)")
        
        // Forward error to Capacitor's Push Notifications plugin via NotificationCenter
        NotificationCenter.default.post(
            name: NSNotification.Name("capacitorDidFailToRegisterForRemoteNotifications"),
            object: error
        )
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Forward to Capacitor for URL handling
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Forward to Capacitor for Universal Links handling
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
