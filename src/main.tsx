import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowUpRight, CalendarCheck, CalendarDays, Check, Clock3, FileText, Link2, MapPin, Moon, Sun,
} from 'lucide-react'
import '@fontsource-variable/dm-sans/wght.css'
import { GroupPicker } from './GroupPicker'
import {
  formatExamDate, formatExamPeriod, formatMonthYear, formatTime, knownGroup, knownSemester, normaliseGroup,
  schedules, semesters, sourceUrlFor,
} from './schedule'
import type { Exam, Semester } from './schedule'
import './style.css'

const semesterKey = 'external-lookup:semester'
const themeKey = 'external-lookup:theme'
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
const announcements = 'https://www.mait.ac.in/'
const reportIssueUrl = 'https://github.com/neolakshay/externals-lookup/issues/new'
const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
const pageReloaded = navigation?.type === 'reload'
type Theme = 'light' | 'dark'

function stored(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function remember(key: string, value: string) {
  try {
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch {
    // The lookup remains usable when storage is unavailable.
  }
}

function currentGroup(useSaved = false, clearGroup = false) {
  const params = new URLSearchParams(window.location.search)
  const query = clearGroup ? null : params.get('group')
  const semesterParam = params.get('semester')
  // Existing group URLs without a semester continue to open first-semester schedules.
  const requestedSemester = semesterParam ?? (query === null && useSaved ? stored(semesterKey) : null) ?? '1'
  const semester: Semester = knownSemester(requestedSemester) ? requestedSemester : '1'
  const invalidSemester = !knownSemester(requestedSemester)
  const code = normaliseGroup(query ?? '', semester)
  return {
    semester,
    code: !invalidSemester && knownGroup(code, semester) ? code : '',
    invalid: invalidSemester || (query !== null && !knownGroup(code, semester)),
    invalidSemester,
  }
}

function saveSemester(semester: Semester) {
  remember(semesterKey, semester)
}

function initialTheme(): Theme {
  const preferred = stored(themeKey)
  if (preferred === 'dark' || preferred === 'light') return preferred
  return systemTheme.matches ? 'dark' : 'light'
}

function groupUrl(code: string, semester: Semester) {
  const url = new URL(window.location.href)
  if (semester === '1') url.searchParams.delete('semester')
  else url.searchParams.set('semester', semester)
  if (code) url.searchParams.set('group', code)
  else url.searchParams.delete('group')
  return url
}

function ExamCard({ exam, semester }: { exam: Exam; semester: Semester }) {
  const schedule = schedules[semester]
  const course = schedule.courses[exam.course]
  const fullDate = `${schedule.dates[exam.date]}, ${formatExamDate(exam.date)}`
  const venue = exam.venue?.replace(/,\s*/g, ', ')
  let venueText = 'Room not specified'
  if (venue === 'HOD') venueText = 'Venue listed as HOD'
  else if (venue?.includes(',')) venueText = `Listed labs ${venue}`
  else if (venue) venueText = `${semester === '1' ? 'Room' : 'Lab / room'} ${venue}`
  return (
    <li className="exam-card">
      <time className="date-tile" dateTime={exam.date}>
        <span className="sr-only">{fullDate}</span>
        <span aria-hidden="true" className="date-day">{exam.date.slice(-2)}</span>
        <span aria-hidden="true" className="date-month">{formatMonthYear(exam.date)}</span>
      </time>
      <div className="exam-details">
        <p className="exam-weekday">{schedule.dates[exam.date]}</p>
        <h3>{course.name}</h3>
        <div className="exam-meta">
          <span><Clock3 size={15} aria-hidden="true" /> <span>{formatTime(exam.slot, semester)}</span></span>
          <span className="exam-venue"><MapPin size={15} aria-hidden="true" /> <span>{venueText}</span></span>
        </div>
        {exam.assignment && <p className="exam-assignment">{exam.assignment}</p>}
        {exam.previousDate && (
          <p className="exam-reschedule">
            <strong>Rescheduled from {formatExamDate(exam.previousDate)}.</strong>{' '}
            The time and room shown are from the original datesheet. Confirm both with MAIT.
          </p>
        )}
      </div>
      <span className="course-code" aria-label={`Course code ${course.code}`}>{course.code}</span>
    </li>
  )
}

function App() {
  const [selection, setSelection] = useState(() => currentGroup(true, pageReloaded))
  const [theme, setTheme] = useState(initialTheme)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  const code = selection.code
  const semester = selection.semester
  const schedule = schedules[semester]
  const group = code ? schedule.groups[code] : undefined
  const groupLabel = group?.label ?? code
  const isDraft = schedule.source.draft

  useEffect(() => {
    const initial = currentGroup(true, pageReloaded)
    if (!initial.invalid) saveSemester(initial.semester)
    if (pageReloaded) {
      const url = new URL(window.location.href)
      url.searchParams.delete('group')
      window.history.replaceState(null, '', url)
    }

    function followHistory() {
      const next = currentGroup()
      if (!next.invalid) saveSemester(next.semester)
      setSelection(next)
      setCopyStatus('idle')
    }

    window.addEventListener('popstate', followHistory)
    return () => window.removeEventListener('popstate', followHistory)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    function followSystem() {
      if (!stored(themeKey)) setTheme(initialTheme())
    }

    systemTheme.addEventListener('change', followSystem)
    return () => systemTheme.removeEventListener('change', followSystem)
  }, [])

  function select(next: string) {
    setSelection({ semester, code: next, invalid: false, invalidSemester: false })
    setCopyStatus('idle')
    saveSemester(semester)
    const url = groupUrl(next, semester)
    if (url.href !== window.location.href) window.history.pushState(null, '', url)
  }

  function selectSemester(next: Semester) {
    setSelection({ semester: next, code: '', invalid: false, invalidSemester: false })
    setCopyStatus('idle')
    saveSemester(next)
    const url = groupUrl('', next)
    if (url.href !== window.location.href) window.history.pushState(null, '', url)
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    remember(themeKey, next)
    setTheme(next)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(groupUrl(code, semester).href)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('manual')
    }
  }

  return (
    <>
      <header className="top-bar">
        <div className="container top-bar-inner">
          <div className="brand">
            <span className="brand-icon"><CalendarCheck size={21} aria-hidden="true" /></span>
            <span>MAIT <span className="brand-divider" aria-hidden="true">/</span> <span className="university">GGSIPU</span></span>
          </div>
          <button className="theme-button" type="button" onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
        </div>
      </header>

      <main className="container">
        <div className="hero">
          <div>
            <p className="kicker">B.Tech semester {semester} <span aria-hidden="true">·</span> 2026–27</p>
            <h1>External Practical Lookup</h1>
            <p className="subtitle">Find your end-term practical exam dates, times and rooms by group.</p>
          </div>
          <div className="exam-period">
            <CalendarDays size={19} aria-hidden="true" />
            <span>{formatExamPeriod(semester)}</span>
          </div>
        </div>

        <div className="layout">
          <aside className="lookup" aria-label="Group lookup">
            <div className="picker-card">
              <fieldset className="semester-picker">
                <legend>Semester</legend>
                <div className="semester-options">
                  {semesters.map(value => (
                    <label key={value}>
                      <input type="radio" name="semester" value={value} checked={semester === value}
                        onChange={() => selectSemester(value)} />
                      <span>Sem {value}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <GroupPicker key={semester} semester={semester} selected={code} onSelect={select} />
            </div>
            <div className="lookup-links">
              <a className="source-link" href={sourceUrlFor(semester)} target="_blank" rel="noreferrer">
                <FileText size={17} aria-hidden="true" /> View {semester === '1' ? 'first-semester' : `semester ${semester}`} {isDraft ? 'draft datesheet' : 'datesheet'} <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </div>
          </aside>

          <section className="schedule" aria-labelledby="schedule-heading">
            <div className="schedule-heading">
              <div>
                <h2 id="schedule-heading">{code ? `Group ${groupLabel}` : 'Practical schedule'}</h2>
                {group && (
                  <p>Sem {semester} <span aria-hidden="true">·</span> {group.branch} <span aria-hidden="true">·</span>{' '}
                    {group.branch === 'CSE-II' && <>2nd shift <span aria-hidden="true">·</span>{' '}</>}
                    {group.exams.length} practicals</p>
                )}
              </div>
              {group && (
                <button className="copy-button" type="button" onClick={copyLink}>
                  {copyStatus === 'copied' ? <Check size={17} aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}
                  {copyStatus === 'copied' ? 'Link copied' : 'Copy link'}
                </button>
              )}
            </div>
            <div className="sr-only" role="status">
              {group ? `Showing ${group.exams.length} practicals for semester ${semester}, group ${groupLabel}.` : ''}
              {copyStatus === 'copied' ? ' Group link copied.' : ''}
            </div>
            {copyStatus === 'manual' && group && (
              <label className="manual-share">
                Copy this group link
                <input type="text" readOnly value={groupUrl(code, semester).href} onFocus={event => event.target.select()} />
              </label>
            )}
            {isDraft && (
              <p className="draft-status"><strong>Draft datesheet.</strong> Check MAIT’s announcements for the confirmed schedule.</p>
            )}
            {group ? (
              <ul className="exam-list">
                {group.exams.map(exam => (
                  <ExamCard key={`${exam.course}/${exam.date}/${exam.slot}/${exam.sourceRow ?? ''}`} exam={exam} semester={semester} />
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <div className="empty-icon"><CalendarDays size={27} aria-hidden="true" /></div>
                {selection.invalid ? (
                  <p role="status"><strong>{selection.invalidSemester ? 'Semester not found.' : 'Group not found.'}</strong> Select your semester and group above to view its schedule.</p>
                ) : (
                  <p>Select your group above to view your external practical examination schedule.</p>
                )}
              </div>
            )}
            {group && schedule.source.instruction && <p className="source-instruction">{schedule.source.instruction}</p>}
          </section>
        </div>
      </main>

      <footer className="container footer">
        <span>MAIT {isDraft ? 'draft' : 'final'} datesheet · Academic session 2026–27</span>
        <a href={announcements} target="_blank" rel="noreferrer">
          Check MAIT announcements for changes <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <a href={reportIssueUrl} target="_blank" rel="noreferrer">Report an issue on GitHub</a>
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
