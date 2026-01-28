import UIKit
import Capacitor

/**
 * Custom ViewController that extends CAPBridgeViewController
 * Registers custom Capacitor plugins
 */
class AppViewController: CAPBridgeViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
    }
    
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        
        // Register custom plugins explicitly
        // In Capacitor 8, custom plugins in the App target need explicit registration
        print("📱 AppViewController: capacitorDidLoad called")
        
        guard let bridge = self.bridge else {
            print("❌ AppViewController: Bridge not available")
            return
        }
        
        print("📱 AppViewController: Bridge available, registering custom plugins...")
        
        // Register CalendarPlugin
        // Note: If this doesn't compile, the method name might be different
        let calendarPlugin = CalendarPlugin()
        bridge.registerPluginInstance(calendarPlugin)
        print("✅ AppViewController: CalendarPlugin registered")
        
        // Register BiometricAuthPlugin
        let biometricPlugin = BiometricAuthPlugin()
        bridge.registerPluginInstance(biometricPlugin)
        print("✅ AppViewController: BiometricAuthPlugin registered")
        
        print("📱 AppViewController: Custom plugins registration complete")
    }
}
