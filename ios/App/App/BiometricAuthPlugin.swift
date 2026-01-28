import Foundation
import Capacitor
import LocalAuthentication

/**
 * BiometricAuthPlugin - Native Capacitor plugin for iOS biometric authentication
 * Uses LocalAuthentication framework for Face ID and Touch ID
 */
@objc(BiometricAuthPlugin)
public class BiometricAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    // CAPBridgedPlugin requirements
    public let identifier = "BiometricAuthPlugin"
    public let jsName = "BiometricAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkBiometry", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]
    
    private let context = LAContext()
    
    /**
     * Check if biometric authentication is available on the device
     */
    @objc func checkBiometry(_ call: CAPPluginCall) {
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        
        var biometryType: String? = nil
        if available {
            switch context.biometryType {
            case .faceID:
                biometryType = "faceID"
            case .touchID:
                biometryType = "touchID"
            case .opticID:
                biometryType = "opticID"
            case .none:
                biometryType = nil
            @unknown default:
                biometryType = nil
            }
        }
        
        call.resolve([
            "isAvailable": available,
            "biometryType": biometryType as Any
        ])
    }
    
    /**
     * Authenticate using biometrics (Face ID, Touch ID, etc.)
     */
    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Authenticate to continue"
        let title = call.getString("title") ?? "Biometric Authentication"
        let subtitle = call.getString("subtitle")
        let description = call.getString("description") ?? reason
        let fallbackTitle = call.getString("fallbackTitle") ?? "Use Password"
        let allowDeviceCredential = call.getBool("allowDeviceCredential") ?? false
        
        // Create a new context for each authentication attempt
        let authContext = LAContext()
        
        // Set fallback button title
        authContext.localizedFallbackTitle = fallbackTitle
        
        // Check if biometric authentication is available
        var error: NSError?
        guard authContext.canEvaluatePolicy(
            allowDeviceCredential ? .deviceOwnerAuthentication : .deviceOwnerAuthenticationWithBiometrics,
            error: &error
        ) else {
            if let error = error {
                call.reject("Biometric authentication not available: \(error.localizedDescription)")
            } else {
                call.reject("Biometric authentication not available")
            }
            return
        }
        
        // Get biometry type for logging
        let biometryType: String
        switch authContext.biometryType {
        case .faceID:
            biometryType = "Face ID"
        case .touchID:
            biometryType = "Touch ID"
        case .opticID:
            biometryType = "Optic ID"
        case .none:
            biometryType = "Biometric"
        @unknown default:
            biometryType = "Biometric"
        }
        
        print("🔐 BiometricAuthPlugin: Starting \(biometryType) authentication")
        
        // Perform biometric authentication
        authContext.evaluatePolicy(
            allowDeviceCredential ? .deviceOwnerAuthentication : .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: reason
        ) { [weak self] success, error in
            DispatchQueue.main.async {
                if success {
                    print("✅ BiometricAuthPlugin: Authentication succeeded")
                    call.resolve([
                        "succeeded": true
                    ])
                } else {
                    if let error = error as? LAError {
                        var errorMessage = "Authentication failed"
                        switch error.code {
                        case .userCancel:
                            errorMessage = "User cancelled authentication"
                        case .userFallback:
                            errorMessage = "User chose to use fallback"
                        case .biometryNotAvailable:
                            errorMessage = "Biometric authentication not available"
                        case .biometryNotEnrolled:
                            errorMessage = "No biometric data enrolled"
                        case .biometryLockout:
                            errorMessage = "Biometric authentication locked out"
                        default:
                            errorMessage = error.localizedDescription
                        }
                        print("❌ BiometricAuthPlugin: Authentication failed - \(errorMessage)")
                        call.reject(errorMessage)
                    } else {
                        print("❌ BiometricAuthPlugin: Authentication failed - \(error?.localizedDescription ?? "Unknown error")")
                        call.reject(error?.localizedDescription ?? "Authentication failed")
                    }
                }
            }
        }
    }
}
