/**
 * Utility functions for formatting and data manipulation
 */

/**
 * Format a phone number to (xxx) xxx-xxxx format
 * @param {string} phoneNumber - Raw phone number string (may contain non-digits)
 * @returns {string} Formatted phone number in (xxx) xxx-xxxx format
 * @example
 * formatPhoneNumber("+15197365418") // Returns: "(519) 736-5418"
 */
export function formatPhoneNumber(phoneNumber) {
    return phoneNumber.replace(/\D/g, '').replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '($2) $3-$4');
}

/**
 * Format a URL by removing protocol and trailing slash
 * @param {string} url - Full URL including protocol
 * @returns {string} Domain and path without protocol or trailing slash
 * @example
 * formatUrl("https://www.example.com/") // Returns: "www.example.com"
 */
export function formatUrl(url) {
    return url.replace(/^(https?:\/\/)?/i, '').replace(/\/$/, '');
}

/**
 * Format time from 24-hour format (e.g., "1830") to 12-hour format (e.g., "6:30 PM")
 * @param {string} time - Time string in 24-hour format (HHMM)
 * @returns {string} Formatted time in 12-hour format with AM/PM
 * @example
 * formatTime("1830") // Returns: "6:30 PM"
 * formatTime("0900") // Returns: "9:00 AM"
 */
export function formatTime(time) {
    const hours = parseInt(time.slice(0, 2), 10);
    const minutes = time.slice(2);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes} ${ampm}`;
}

/**
 * Get the current day of the week
 * @returns {string} Full day name (e.g., "Monday", "Tuesday")
 */
export function getCurrentDay() {
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return daysOfWeek[new Date().getDay()];
}

/**
 * Sort masses by day and time
 * Modifies the array in place
 * @param {Array<{day: string, time: string}>} masses - Array of mass objects
 * @returns {void}
 */
export function sortMasses(masses) {
    const orderOfDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    masses.sort((a, b) => {
        const dayComparison = orderOfDays.indexOf(a.day) - orderOfDays.indexOf(b.day);
        return dayComparison !== 0 ? dayComparison : a.time.localeCompare(b.time);
    });
}

/**
 * Sort time ranges by day and start time
 * Modifies the array in place
 * @param {Array<{day: string, start: string}>} elms - Array of time range objects
 * @returns {void}
 */
export function sortTimeRange(elms) {
    const orderOfDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    elms.sort((a, b) => {
        const dayComparison = orderOfDays.indexOf(a.day) - orderOfDays.indexOf(b.day);
        return dayComparison !== 0 ? dayComparison : a.start.localeCompare(b.start);
    });
}

/**
 * Days of the week in order
 * @constant {string[]}
 */
export const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Time options for filter dropdowns (24-hour format values with 12-hour labels)
 * @constant {Array<{value: string, label: string}>}
 */
export const TIME_OPTIONS = [
    { value: "0000", label: "12am" },
    { value: "0100", label: "1am" },
    { value: "0200", label: "2am" },
    { value: "0300", label: "3am" },
    { value: "0400", label: "4am" },
    { value: "0500", label: "5am" },
    { value: "0600", label: "6am" },
    { value: "0700", label: "7am" },
    { value: "0800", label: "8am" },
    { value: "0900", label: "9am" },
    { value: "1000", label: "10am" },
    { value: "1100", label: "11am" },
    { value: "1200", label: "12pm" },
    { value: "1300", label: "1pm" },
    { value: "1400", label: "2pm" },
    { value: "1500", label: "3pm" },
    { value: "1600", label: "4pm" },
    { value: "1700", label: "5pm" },
    { value: "1800", label: "6pm" },
    { value: "1900", label: "7pm" },
    { value: "2000", label: "8pm" },
    { value: "2100", label: "9pm" },
    { value: "2200", label: "10pm" },
    { value: "2300", label: "11pm" },
];
