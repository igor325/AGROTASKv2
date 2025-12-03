/**
 * Timezone utilities for Brazil (GMT-3)
 * 
 * Database stores dates in GMT+0 (UTC)
 * Frontend displays and inputs in GMT-3 (Brazil/Sao_Paulo)
 */

/**
 * Converts a local date+time (Brazil GMT-3) to ISO string (GMT+0) for database storage
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM format
 * @returns ISO string in GMT+0
 */
export function toUTC(dateString: string, timeString: string): string {
  // Parse as Brazil timezone (GMT-3)
  // Create a date string that represents the BRAZIL local time
  const dateTimeStr = `${dateString}T${timeString}:00`
  
  // Parse the date components
  const [year, month, day] = dateString.split('-').map(Number)
  const [hour, minute] = timeString.split(':').map(Number)
  
  // Create a Date object in Brazil timezone by adding 3 hours to convert to UTC
  const brazilDate = new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0))
  
  return brazilDate.toISOString()
}

/**
 * Converts a GMT+0 (UTC) ISO string from database to local Brazil time components
 * @param isoString - ISO string in GMT+0
 * @returns Object with date and time in Brazil timezone
 */
export function fromUTC(isoString: string | null): { date: string; time: string } | null {
  if (!isoString) return null
  
  // CRITICAL: Normalize the date string
  // Replace spaces with T (Postgres format: "2025-11-04 02:52:56" -> ISO: "2025-11-04T02:52:56")
  let normalized = isoString.replace(' ', 'T')
  
  // Remove timezone offsets if present (+00:00, -03:00, etc)
  normalized = normalized.replace(/[+-]\d{2}:\d{2}$/, '')
  
  // CRITICAL: Ensure the string is treated as UTC
  // If it doesn't end with 'Z', add it
  if (!normalized.endsWith('Z')) {
    normalized = normalized + 'Z'
  }
  
  const date = new Date(normalized)
  
  // Format to Brazil timezone (America/Sao_Paulo = GMT-3)
  const brazilDateStr = date.toLocaleString('en-CA', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  // Format is: YYYY-MM-DD, HH:MM:SS
  const [datepart, timepart] = brazilDateStr.split(', ')
  const time = timepart ? timepart.substring(0, 5) : '00:00' // Remove seconds
  
  return {
    date: datepart,
    time: time
  }
}

/**
 * Get current date in Brazil timezone (YYYY-MM-DD format)
 */
export function getCurrentBrazilDate(): string {
  const now = new Date()
  const brazilDate = new Date(now.getTime() - (3 * 60 * 60 * 1000))
  
  const year = brazilDate.getUTCFullYear()
  const month = String(brazilDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(brazilDate.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Get current time in Brazil timezone (HH:MM format)
 */
export function getCurrentBrazilTime(): string {
  const now = new Date()
  const brazilDate = new Date(now.getTime() - (3 * 60 * 60 * 1000))
  
  const hours = String(brazilDate.getUTCHours()).padStart(2, '0')
  const minutes = String(brazilDate.getUTCMinutes()).padStart(2, '0')
  
  return `${hours}:${minutes}`
}

