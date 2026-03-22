// ─── Districts ───────────────────────────────────────────────
export const DISTRICTS = ['OWOSENI', 'IHOGBE', 'IBIWE', 'MERCY', 'OROEGHENE'] as const
export type District = typeof DISTRICTS[number]

// ─── Service days ─────────────────────────────────────────────
export type ServiceDay = 'sunday' | 'monday' | 'thursday'

// ─── Attendance block (reused for Adults, Youth, Children) ────
export interface AttendanceBlock {
  men?: number      // adults only
  women?: number    // adults only
  boys?: number     // youth / children
  girls?: number    // youth / children
}

// ─── Single service entry ─────────────────────────────────────
export interface ServiceEntry {
  id?: string
  district: District
  service_date: string          // ISO date e.g. "2025-03-02"
  service_day: ServiceDay       // sunday | monday | thursday
  month: string                 // "2025-03" for grouping
  year: number
  week_of_month: number         // 1–5

  // HCF (only for Sunday)
  hcf_count?: number
  hcf_present?: number
  hcf_new_comers?: number

  // Adults
  adult_men: number
  adult_women: number

  // Youth
  youth_boys: number
  youth_girls: number

  // Children
  children_boys: number
  children_girls: number

  // Offerings
  tithes_offering: number
  special_offering: number

  submitted_at?: string
  submitted_by?: string
}

// ─── Empty entry factory ──────────────────────────────────────
export function emptyEntry(
  district: District,
  service_date: string,
  service_day: ServiceDay,
  month: string,
  year: number,
  week_of_month: number
): ServiceEntry {
  return {
    district, service_date, service_day, month, year, week_of_month,
    hcf_count: 0, hcf_present: 0, hcf_new_comers: 0,
    adult_men: 0, adult_women: 0,
    youth_boys: 0, youth_girls: 0,
    children_boys: 0, children_girls: 0,
    tithes_offering: 0, special_offering: 0,
  }
}

// ─── Calculated totals ────────────────────────────────────────
export function calcEntry(e: ServiceEntry) {
  const adults = e.adult_men + e.adult_women
  const youth = e.youth_boys + e.youth_girls
  const children = e.children_boys + e.children_girls
  const subtotal = adults + youth + children   // subtotal only used for Sunday
  return { adults, youth, children, subtotal }
}

// ─── Calendar engine ──────────────────────────────────────────
export interface ServiceDate {
  date: string          // ISO "YYYY-MM-DD"
  day: ServiceDay
  weekOfMonth: number   // 1–5
  label: string         // "Sun 2 Mar"
}

export function getServiceDates(year: number, month: number): ServiceDate[] {
  // month is 1-indexed (1=Jan, 12=Dec)
  const dates: ServiceDate[] = []
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay() // 0=Sun, 1=Mon, 4=Thu

    let day: ServiceDay | null = null
    if (dow === 0) day = 'sunday'
    else if (dow === 1) day = 'monday'
    else if (dow === 4) day = 'thursday'

    if (day) {
      const iso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const weekOfMonth = Math.ceil(d / 7)
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      dates.push({
        date: iso,
        day,
        weekOfMonth,
        label: `${dayNames[dow]} ${d} ${monthNames[month-1]}`,
      })
    }
  }

  return dates
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2,'0')}`
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-')
  return { year: parseInt(y), month: parseInt(m) }
}

export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]
