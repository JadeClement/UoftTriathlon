import Foundation
import Capacitor
import EventKit

/**
 * CalendarPlugin - Custom Capacitor plugin for iOS calendar integration
 * Allows adding events to the user's calendar using EventKit
 */
@objc(CalendarPlugin)
public class CalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    // CAPBridgedPlugin requirements
    public let identifier = "CalendarPlugin"
    public let jsName = "Calendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "addEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasEvent", returnType: CAPPluginReturnPromise)
    ]
    
    private let eventStore = EKEventStore()
    
    /**
     * Add an event to the user's calendar
     */
    @objc public func addEvent(_ call: CAPPluginCall) {
        guard let title = call.getString("title") else {
            call.reject("Title is required")
            return
        }
        
        guard let startDateString = call.getString("startDate") else {
            call.reject("Start date is required")
            return
        }
        
        guard let endDateString = call.getString("endDate") else {
            call.reject("End date is required")
            return
        }
        
        // Parse ISO date strings
        let iso8601Formatter = ISO8601DateFormatter()
        iso8601Formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        guard let startDate = iso8601Formatter.date(from: startDateString) ?? {
            // Try without fractional seconds
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.date(from: startDateString)
        }() else {
            call.reject("Invalid start date format")
            return
        }
        
        guard let endDate = iso8601Formatter.date(from: endDateString) ?? {
            // Try without fractional seconds
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.date(from: endDateString)
        }() else {
            call.reject("Invalid end date format")
            return
        }
        
        let notes = call.getString("notes") ?? ""
        
        // Request calendar access
        eventStore.requestAccess(to: .event) { [weak self] (granted, error) in
            guard let self = self else { return }
            
            if let error = error {
                call.reject("Calendar access error: \(error.localizedDescription)")
                return
            }
            
            if !granted {
                call.reject("Calendar access denied")
                return
            }
            
            // Create the event
            let event = EKEvent(eventStore: self.eventStore)
            event.title = title
            event.startDate = startDate
            event.endDate = endDate
            event.notes = notes
            event.calendar = self.eventStore.defaultCalendarForNewEvents
            
            // Save the event
            do {
                try self.eventStore.save(event, span: .thisEvent)
                call.resolve([
                    "success": true,
                    "eventId": event.eventIdentifier ?? ""
                ])
            } catch {
                call.reject("Failed to save event: \(error.localizedDescription)")
            }
        }
    }
    
    /**
     * Check if an event exists in the calendar
     */
    @objc public func hasEvent(_ call: CAPPluginCall) {
        guard let startDateString = call.getString("startDate") else {
            call.reject("Start date is required")
            return
        }
        
        guard let title = call.getString("title") else {
            call.reject("Title is required")
            return
        }
        
        // Parse start date
        let iso8601Formatter = ISO8601DateFormatter()
        iso8601Formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        guard let startDate = iso8601Formatter.date(from: startDateString) ?? {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.date(from: startDateString)
        }() else {
            call.reject("Invalid start date format")
            return
        }
        
        // Request calendar access
        eventStore.requestAccess(to: .event) { [weak self] (granted, error) in
            guard let self = self else { return }
            
            if let error = error {
                call.reject("Calendar access error: \(error.localizedDescription)")
                return
            }
            
            if !granted {
                call.resolve(["hasEvent": false])
                return
            }
            
            // Search for events matching the title and date
            let calendar = Calendar.current
            let startOfDay = calendar.startOfDay(for: startDate)
            let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
            
            let predicate = self.eventStore.predicateForEvents(withStart: startOfDay, end: endOfDay, calendars: nil)
            let events = self.eventStore.events(matching: predicate)
            
            let hasEvent = events.contains { event in
                event.title == title && abs(event.startDate.timeIntervalSince(startDate)) < 3600 // Within 1 hour
            }
            
            call.resolve(["hasEvent": hasEvent])
        }
    }
}
