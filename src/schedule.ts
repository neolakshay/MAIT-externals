import datesheet from './datesheet.json'
import semesterThree from './datesheet-semester-3.json'
import semesterFive from './datesheet-semester-5.json'
import semesterSeven from './datesheet-semester-7.json'

export interface Exam {
  course: string
  date: string
  slot: string
  venue: string | null
  sourceRow?: number
  assignment?: string
  previousDate?: string
}

interface Group {
  branch: string
  label?: string
  exams: Exam[]
}

export interface Datesheet {
  groups: Record<string, Group>
  courses: Record<string, { name: string; code: string }>
  dates: Record<string, string>
  slots: Record<string, { start: string; end: string }>
  aliases?: Record<string, string>
  groupChoices?: Record<string, string[]>
  source: { file: string; page?: number; instruction?: string; draft?: boolean }
}

export const semesters = ['1', '3', '5', '7'] as const
export type Semester = typeof semesters[number]
export const schedules: Record<Semester, Datesheet> = {
  '1': datesheet,
  '3': semesterThree,
  '5': semesterFive,
  '7': semesterSeven,
}

export function knownSemester(value: string): value is Semester {
  return Object.hasOwn(schedules, value)
}

export function groupCodesFor(semester: Semester) {
  return Object.keys(schedules[semester].groups).sort(
    new Intl.Collator('en', { numeric: true, ignorePunctuation: true }).compare,
  )
}

export const sharedGroup = 'EE4/ME4'

export function sourceUrlFor(semester: Semester) {
  const source = schedules[semester].source
  const page = source.page ? '#page=' + source.page : ''
  return import.meta.env.BASE_URL + source.file + page
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })

export function normaliseGroup(value: string, semester: Semester = '1') {
  const code = value.replace(/\s/g, '').toUpperCase()
  return schedules[semester].aliases?.[code] ?? code
}

export function knownGroup(code: string, semester: Semester = '1') {
  return Object.hasOwn(schedules[semester].groups, code)
}

const shortDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export function formatExamPeriod(semester: Semester) {
  const dates = Object.keys(schedules[semester].dates).sort()
  const first = new Date(dates[0] + 'T00:00Z')
  const last = new Date(dates[dates.length - 1] + 'T00:00Z')
  return `${shortDateFormat.format(first)} – ${shortDateFormat.format(last)} ${last.getUTCFullYear()}`
}

export function formatMonthYear(date: string) {
  return dateFormat.format(new Date(date + 'T00:00Z'))
}

export function formatExamDate(date: string) {
  return `${Number(date.slice(-2))} ${formatMonthYear(date)}`
}

export function formatTime(slot: string, semester: Semester = '1') {
  const time = schedules[semester].slots[slot]
  if (!time) return 'Time not specified'
  const start = timeFormat.format(new Date('2000-01-01T' + time.start + 'Z'))
  const end = timeFormat.format(new Date('2000-01-01T' + time.end + 'Z'))
  return start + ' – ' + end
}
