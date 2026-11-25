import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const data = JSON.parse(readFileSync(new URL('../src/datesheet.json', import.meta.url), 'utf8'))
const range = (prefix, count) => Array.from({ length: count }, (_, index) => prefix + (index + 1))
const poolA = [...range('C', 21), ...range('I', 15), ...range('E', 6)]
const poolB = [
  ...range('CST', 9), ...range('C(AIML)', 9), ...range('E(VLSI)', 3), ...range('EE', 4),
  ...range('ME', 4), 'EE4/ME4',
]
const slotOrder = ['FN', 'N', 'AN']

test('every code in the group legend and the shared table label is represented', () => {
  assert.equal(poolA.length + poolB.length, 72)
  assert.deepEqual(Object.keys(data.groups).sort(), [...poolA, ...poolB].sort())
  for (const code of poolA) {
    assert.deepEqual(data.groups[code].exams.map(exam => exam.course).sort(),
      ['electrical', 'environmental', 'graphics', 'physics', 'problem-solving'])
  }
  for (const code of poolB) {
    assert.deepEqual(data.groups[code].exams.map(exam => exam.course).sort(),
      ['applied-physics', 'environmental', 'graphics', 'programming-c'])
  }
})

test('all 330 cells match the verified first-semester workbook schedule', () => {
  const rows = Object.entries(data.groups).flatMap(([code, { exams }]) =>
    exams.map(({ course, date, previousDate, slot, venue }) => [code, course, previousDate ?? date, slot, venue].join('|')),
  )
  assert.equal(rows.length, 330)
  assert.equal(new Set(rows).size, 330)
  // Canonical group|course|date|slot|venue rows verified against C8:Z28 and the merged room cells.
  const fingerprint = createHash('sha256').update(rows.sort().join('\n')).digest('hex')
  assert.equal(fingerprint, '2b6ce17dfc69403cf6a05d203457726660a7f5859b1ac704534b8fd9f5fc6bab')
})

test('printed times, title and course codes are preserved verbatim', () => {
  assert.deepEqual(data.slots, {
    FN: { start: '09:00', end: '11:30' },
    N: { start: '11:30', end: '14:00' },
    AN: { start: '14:00', end: '16:30' },
  })
  assert.equal(data.source.reportingTime, null)
  assert.match(data.source.title, /Final Date Sheet/)
  assert.equal(data.source.sheet, 'ETP Datesheet 1st sem ')
  assert.equal(data.source.range, 'A1:AA36')
  assert.deepEqual(Object.values(data.courses).map(({ name, code }) => `${name} (${code})`), [
    'Engineering Physics Lab (ICT-111P)',
    'Applied Physics Lab (BS-151)',
    'Engineering Graphics-I Lab (ICT-123P/ES-157)',
    'Basics of Electrical Engineering Lab (ICT-103P)',
    'Programming of Problem Solving Lab (ICT-101P)',
    'Programming in "C" Lab (ES-153)',
    'Environmental Studies Lab (ICT117P/BS-161)',
  ])
})

test('all dates, weekdays and revised slot totals agree and groups are sorted', () => {
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' })
  const dates = [
    '2026-11-26', '2026-11-27', '2026-11-30', '2026-12-01',
    '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05',
  ]
  assert.deepEqual(Object.keys(data.dates), dates)
  const allExams = Object.values(data.groups).flatMap(group => group.exams)
  const expectedTotals = [15, 15, 16, 15, 14, 12, 11, 12]
  for (const [index, date] of dates.entries()) {
    assert.equal(data.dates[date], weekday.format(new Date(date + 'T00:00Z')))
    for (const slot of slotOrder) {
      assert.equal(allExams.filter(exam => exam.date === date && exam.slot === slot).length, expectedTotals[index])
    }
  }
  for (const { exams } of Object.values(data.groups)) {
    const sequence = exams.map(exam => exam.date + slotOrder.indexOf(exam.slot))
    assert.deepEqual(sequence, [...sequence].sort())
  }
})

test('only E1–E3 Graphics moved to 30 November, with their original slots and room', () => {
  const revisedExams = Object.entries(data.groups).flatMap(([code, { exams }]) =>
    exams.filter(exam => exam.previousDate).map(exam => ({ code, ...exam })),
  )
  assert.deepEqual(revisedExams, slotOrder.map((slot, index) => ({
    code: 'E' + (index + 1), course: 'graphics', date: '2026-11-30', slot, venue: '227',
    previousDate: '2026-12-04',
  })))
})

test('no group has overlapping exam slots after the reschedule', () => {
  for (const [code, { exams }] of Object.entries(data.groups)) {
    const slots = exams.map(({ date, slot }) => `${date}/${slot}`)
    assert.equal(new Set(slots).size, slots.length, `Overlapping exams for ${code}`)
  }
})

test('similar group codes and the three EE4/ME4 variants have distinct slots', () => {
  assert.deepEqual(data.groups.C12.exams[0], {
    course: 'graphics', date: '2026-11-26', slot: 'AN', venue: '312',
  })
  assert.deepEqual(data.groups.I12.exams[0], {
    course: 'electrical', date: '2026-11-26', slot: 'AN', venue: '524',
  })
  for (const [group, slot] of [['EE4', 'FN'], ['EE4/ME4', 'N'], ['ME4', 'AN']]) {
    assert.deepEqual(data.groups[group].exams.map(exam => exam.slot), Array(4).fill(slot))
  }
})

test('the linked PDF contains the verified first-semester workbook rendering', () => {
  const pdf = readFileSync(new URL('../public/' + data.source.file, import.meta.url))
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  assert.equal(createHash('sha256').update(pdf).digest('hex'),
    'f823dce86296591d52cf71f80705ddd288ce9da5ceafc6c47707feaa413c177b')
})

for (const [semester, entryCount, fingerprint, perDay] of [
  [3, 288, 'ea2491fbf9af9808bf74d3dfad4bb37487f071c3a39e454279a8633f2930db44', [13, 20, 14, 19, 10, 14, 6, 0]],
  [5, 342, '126ab84bc187da9ad813438233626bf9169f7ca8745a2d578c49d27f1631b181', [17, 18, 13, 17, 13, 14, 13, 9]],
]) {
  const schedule = JSON.parse(readFileSync(new URL(`../src/datesheet-semester-${semester}.json`, import.meta.url), 'utf8'))
  test(`semester ${semester} includes every roster group and verified PDF cell`, () => {
    const expectedGroups = [
      ...range('C', 21), ...range('I', semester === 3 ? 15 : 9), ...range('CST', 9),
      ...range('C(AI)', 3), ...range('C(AIML)', 3), ...range('C(DS)', 3),
      ...range('E', 3), ...range('E(VLSI)', 3), ...range('E(ACT)', 3),
      ...range('EE', 3), ...range('ME', 3),
      ...(semester === 5 ? range('ITE', 6) : []),
    ]
    assert.deepEqual(Object.keys(schedule.groups).sort(), expectedGroups.sort())
    assert.equal(expectedGroups.length, 69)
    const rows = Object.entries(schedule.groups).flatMap(([code, { exams }]) =>
      exams.map(({ course, date, slot, venue }) => [code, course, date, slot, venue].join('|')),
    )
    assert.equal(rows.length, entryCount)
    assert.equal(new Set(rows).size, entryCount)
    assert.equal(createHash('sha256').update(rows.sort().join('\n')).digest('hex'), fingerprint)
    const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' })
    const exams = Object.values(schedule.groups).flatMap(group => group.exams)
    for (const [index, date] of Object.keys(schedule.dates).entries()) {
      assert.equal(schedule.dates[date], weekday.format(new Date(date + 'T00:00Z')))
      for (const slot of slotOrder) {
        assert.equal(exams.filter(exam => exam.date === date && exam.slot === slot).length, perDay[index])
      }
    }
    for (const [code, { exams }] of Object.entries(schedule.groups)) {
      const fiveCourses = semester === 3 ? /^(E|E\(VLSI\)|E\(ACT\)|ME)\d+$/.test(code) : !code.startsWith('ME')
      assert.equal(exams.length, fiveCourses ? 5 : 4)
      assert.equal(new Set(exams.map(exam => exam.course)).size, exams.length)
      const sequence = exams.map(exam => exam.date + slotOrder.indexOf(exam.slot))
      assert.deepEqual(sequence, [...sequence].sort())
      for (const exam of exams) {
        assert.ok(schedule.courses[exam.course])
        assert.ok(exam.sourceRow >= 3)
      }
    }
  })
}

test('semester-specific source pages and roster aliases agree with the supplied files', () => {
  const third = JSON.parse(readFileSync(new URL('../src/datesheet-semester-3.json', import.meta.url), 'utf8'))
  const fifth = JSON.parse(readFileSync(new URL('../src/datesheet-semester-5.json', import.meta.url), 'utf8'))
  assert.equal(third.aliases['C-1'], 'C1')
  assert.equal(third.aliases['E(VLSI)-3'], 'E(VLSI)3')
  assert.equal(fifth.aliases.M1, 'ME1')
  assert.equal(third.source.page, 1)
  assert.equal(fifth.source.page, 2)
  const pdf = readFileSync(new URL('../public/' + third.source.file, import.meta.url))
  assert.equal(createHash('sha256').update(pdf).digest('hex'),
    '3e8b7b3126ae77a3d22e902a337931ba8c0341e286819adb97e48396d0675f99')
})

test('semester 7 matches the draft worksheet cells and preserves unspecified slots', () => {
  const schedule = JSON.parse(readFileSync(new URL('../src/datesheet-semester-7.json', import.meta.url), 'utf8'))
  const cells = new Set()
  const rows = Object.entries(schedule.groups).flatMap(([code, { exams }]) =>
    exams.map(({ course, date, slot, venue, sourceRow, assignment = '' }) => {
      cells.add([sourceRow, date, slot].join('|'))
      return [code, course, date, slot, venue, sourceRow, assignment].join('|')
    }),
  )
  assert.equal(schedule.source.draft, true)
  assert.equal(Object.keys(schedule.groups).length, 86)
  assert.equal(cells.size, 188)
  assert.equal([...cells].filter(cell => cell.endsWith('|DAY')).length, 114)
  assert.equal(schedule.slots.DAY, undefined)
  assert.equal(rows.length, 271)
  assert.equal(createHash('sha256').update(rows.sort().join('\n')).digest('hex'),
    '7aefcd45e36baa4f682433f0e8c2c1e8b4a39f86eefec2154520ad39bcf1d13e')
  assert.deepEqual(schedule.groups['EC(ACT)8'].exams.map(({ assignment }) => assignment),
    ['EC(ACT)7+1/2EC(ACT)8', '1/2EC(ACT)8+EC(ACT)9'])
})
