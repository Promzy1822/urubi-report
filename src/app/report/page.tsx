'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import ToastContainer from '@/components/ui/Toast'
import {
  DISTRICTS, District, ServiceEntry, ServiceDay,
  calcEntry, getServiceDates, getMonthKey,
  MONTH_NAMES, parseMonthKey
} from '@/types'

const DAY_COLORS: Record<ServiceDay, string> = {
  sunday: '#7C3AED', monday: '#2563EB', thursday: '#D97706'
}
const DAY_LABELS: Record<ServiceDay, string> = {
  sunday: 'Sunday', monday: 'Monday', thursday: 'Thursday'
}

export default function ReportPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState('')
  const [userDistrict, setUserDistrict] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [entries, setEntries] = useState<ServiceEntry[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const meta = session.user.user_metadata
      setUserRole(meta.role || '')
      setUserDistrict(meta.district || '')
      setUserEmail(session.user.email || '')
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    async function fetchEntries() {
      const mk = getMonthKey(year, month)
      const supabase = createClient()
      const { data } = await supabase
        .from('service_entries').select('*')
        .eq('month', mk)
        .order('service_date', { ascending: true })
      setEntries(data || [])
    }
    if (!loading) fetchEntries()
  }, [year, month, loading])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  if (loading) return <div className="loader"><div className="spinner" /><p>Loading…</p></div>

  const isAdmin = userRole === 'admin'
  const serviceDates = getServiceDates(year, month)

  // Group by service day type
  const sundays = serviceDates.filter(s => s.day === 'sunday')
  const mondays = serviceDates.filter(s => s.day === 'monday')
  const thursdays = serviceDates.filter(s => s.day === 'thursday')

  // Helper: get entry for a district + date
  const getEntry = (district: District, date: string) =>
    entries.find(e => e.district === district && e.service_date === date)

  // Helper: sum across districts for a date
  const dateTotal = (date: string) => {
    const de = entries.filter(e => e.service_date === date)
    return {
      adultMen: de.reduce((s,e) => s+e.adult_men, 0),
      adultWomen: de.reduce((s,e) => s+e.adult_women, 0),
      youthBoys: de.reduce((s,e) => s+e.youth_boys, 0),
      youthGirls: de.reduce((s,e) => s+e.youth_girls, 0),
      childBoys: de.reduce((s,e) => s+e.children_boys, 0),
      childGirls: de.reduce((s,e) => s+e.children_girls, 0),
      tithes: de.reduce((s,e) => s+e.tithes_offering, 0),
      special: de.reduce((s,e) => s+e.special_offering, 0),
      subtotal: de.reduce((s,e) => {
        const t = calcEntry(e); return s + t.subtotal
      }, 0),
    }
  }

  // Monthly grand totals
  const grandTotal = {
    attendance: entries.reduce((s,e) => s + e.adult_men + e.adult_women + e.youth_boys + e.youth_girls + e.children_boys + e.children_girls, 0),
    tithes: entries.reduce((s,e) => s + e.tithes_offering, 0),
    special: entries.reduce((s,e) => s + e.special_offering, 0),
    newComers: entries.reduce((s,e) => s + (e.hcf_new_comers || 0), 0),
  }

  const submitted = Array.from(new Set(entries.map(e => e.district)))

  // Render a section table for one service day type
  const renderSection = (dates: typeof sundays, day: ServiceDay) => {
    if (dates.length === 0) return null
    const color = DAY_COLORS[day]
    const isSunday = day === 'sunday'

    return (
      <div className="card" key={day}>
        <div className="card-head" style={{ background: `${color}10`, borderColor: `${color}25` }}>
          <div>
            <h3 style={{ color }}>{DAY_LABELS[day]} Services</h3>
            <p>{dates.length} {DAY_LABELS[day]}s in {MONTH_NAMES[month-1]}</p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {dates.map(sd => (
              <span key={sd.date} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: `${color}15`, color }}>
                {sd.label}
              </span>
            ))}
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ minWidth: '80px' }}>District</th>
                {dates.map(sd => (
                  <th key={sd.date} colSpan={isSunday ? 8 : 7} style={{ textAlign: 'center', borderLeft: `2px solid ${color}30`, color }}>
                    {sd.label}
                  </th>
                ))}
                <th colSpan={isSunday ? 8 : 7} style={{ textAlign: 'center', background: `${color}10`, color }}>
                  TOTAL
                </th>
              </tr>
              <tr>
                {dates.map(sd => (
                  <th key={sd.date} colSpan={isSunday ? 8 : 7} style={{ borderLeft: `2px solid ${color}30` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isSunday ? 'repeat(8,1fr)' : 'repeat(7,1fr)', gap: 0 }}>
                      <span style={{ textAlign:'center' }}>M</span>
                      <span style={{ textAlign:'center' }}>W</span>
                      <span style={{ textAlign:'center' }}>T</span>
                      <span style={{ textAlign:'center' }}>B</span>
                      <span style={{ textAlign:'center' }}>G</span>
                      <span style={{ textAlign:'center' }}>T</span>
                      <span style={{ textAlign:'center' }}>B</span>
                      <span style={{ textAlign:'center' }}>G</span>
                      {isSunday && <span style={{ textAlign:'center', fontWeight:800 }}>Sub</span>}
                    </div>
                  </th>
                ))}
                <th colSpan={isSunday ? 8 : 7} style={{ background: `${color}10` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isSunday ? 'repeat(8,1fr)' : 'repeat(7,1fr)', gap: 0 }}>
                    <span style={{ textAlign:'center' }}>M</span>
                    <span style={{ textAlign:'center' }}>W</span>
                    <span style={{ textAlign:'center' }}>T</span>
                    <span style={{ textAlign:'center' }}>B</span>
                    <span style={{ textAlign:'center' }}>G</span>
                    <span style={{ textAlign:'center' }}>T</span>
                    <span style={{ textAlign:'center' }}>B</span>
                    <span style={{ textAlign:'center' }}>G</span>
                    {isSunday && <span style={{ textAlign:'center', fontWeight:800 }}>Sub</span>}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {DISTRICTS.map(d => {
                // Totals across all dates for this district
                const distEntries = dates.map(sd => getEntry(d, sd.date))
                const distTotals = {
                  adM: distEntries.reduce((s,e) => s+(e?.adult_men||0),0),
                  adW: distEntries.reduce((s,e) => s+(e?.adult_women||0),0),
                  yuB: distEntries.reduce((s,e) => s+(e?.youth_boys||0),0),
                  yuG: distEntries.reduce((s,e) => s+(e?.youth_girls||0),0),
                  chB: distEntries.reduce((s,e) => s+(e?.children_boys||0),0),
                  chG: distEntries.reduce((s,e) => s+(e?.children_girls||0),0),
                }
                const distSub = distTotals.adM+distTotals.adW+distTotals.yuB+distTotals.yuG+distTotals.chB+distTotals.chG

                const cell = (v: number) => <td style={{ textAlign:'center', padding:'6px 4px' }}>{v||''}</td>

                return (
                  <tr key={d}>
                    <td style={{ fontWeight:700, whiteSpace:'nowrap' }}>{d}</td>
                    {dates.map(sd => {
                      const e = getEntry(d, sd.date)
                      const t = e ? calcEntry(e) : null
                      return (
                        <td key={sd.date} colSpan={isSunday ? 8 : 7} style={{ borderLeft:`2px solid ${color}20`, padding:0 }}>
                          <div style={{ display:'grid', gridTemplateColumns: isSunday ? 'repeat(8,1fr)' : 'repeat(7,1fr)' }}>
                            {cell(e?.adult_men||0)}
                            {cell(e?.adult_women||0)}
                            {cell(t?.adults||0)}
                            {cell(e?.youth_boys||0)}
                            {cell(e?.youth_girls||0)}
                            {cell(t?.youth||0)}
                            {cell(e?.children_boys||0)}
                            {cell(e?.children_girls||0)}
                            {isSunday && <td style={{ textAlign:'center', padding:'6px 4px', fontWeight:800, color }}>{t?.subtotal||''}</td>}
                          </div>
                        </td>
                      )
                    })}
                    {/* District total */}
                    <td colSpan={isSunday ? 8 : 7} style={{ background:`${color}08`, padding:0 }}>
                      <div style={{ display:'grid', gridTemplateColumns: isSunday ? 'repeat(8,1fr)' : 'repeat(7,1fr)' }}>
                        {cell(distTotals.adM)}{cell(distTotals.adW)}
                        {cell(distTotals.adM+distTotals.adW)}
                        {cell(distTotals.yuB)}{cell(distTotals.yuG)}
                        {cell(distTotals.yuB+distTotals.yuG)}
                        {cell(distTotals.chB)}{cell(distTotals.chG)}
                        {isSunday && <td style={{ textAlign:'center', padding:'6px 4px', fontWeight:800, color }}>{distSub||''}</td>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              {/* Date totals */}
              <tr style={{ background: `${color}10` }}>
                <td style={{ fontWeight:800 }}>TOTAL</td>
                {dates.map(sd => {
                  const dt = dateTotal(sd.date)
                  const cell = (v: number) => <td style={{ textAlign:'center', padding:'7px 4px', fontWeight:700 }}>{v||''}</td>
                  return (
                    <td key={sd.date} colSpan={isSunday ? 8 : 7} style={{ borderLeft:`2px solid ${color}30`, padding:0 }}>
                      <div style={{ display:'grid', gridTemplateColumns: isSunday ? 'repeat(8,1fr)' : 'repeat(7,1fr)' }}>
                        {cell(dt.adultMen)}{cell(dt.adultWomen)}
                        {cell(dt.adultMen+dt.adultWomen)}
                        {cell(dt.youthBoys)}{cell(dt.youthGirls)}
                        {cell(dt.youthBoys+dt.youthGirls)}
                        {cell(dt.childBoys)}{cell(dt.childGirls)}
                        {isSunday && <td style={{ textAlign:'center', padding:'7px 4px', fontWeight:800, color }}>{dt.subtotal||''}</td>}
                      </div>
                    </td>
                  )
                })}
                {/* Grand total col */}
                <td colSpan={isSunday ? 8 : 7} style={{ background:`${color}15`, padding:0 }}>
                  <div style={{ display:'grid', gridTemplateColumns: isSunday ? 'repeat(8,1fr)' : 'repeat(7,1fr)' }}>
                    {(() => {
                      const all = dates.flatMap(sd => entries.filter(e => e.service_date === sd.date))
                      const adM = all.reduce((s,e)=>s+e.adult_men,0)
                      const adW = all.reduce((s,e)=>s+e.adult_women,0)
                      const yuB = all.reduce((s,e)=>s+e.youth_boys,0)
                      const yuG = all.reduce((s,e)=>s+e.youth_girls,0)
                      const chB = all.reduce((s,e)=>s+e.children_boys,0)
                      const chG = all.reduce((s,e)=>s+e.children_girls,0)
                      const sub = adM+adW+yuB+yuG+chB+chG
                      const c = (v:number) => <td key={v+Math.random()} style={{textAlign:'center',padding:'7px 4px',fontWeight:800}}>{v||''}</td>
                      return <>{c(adM)}{c(adW)}{c(adM+adW)}{c(yuB)}{c(yuG)}{c(yuB+yuG)}{c(chB)}{c(chG)}{isSunday&&<td style={{textAlign:'center',padding:'7px 4px',fontWeight:800,color}}>{sub||''}</td>}</>
                    })()}
                  </div>
                </td>
              </tr>
              {/* Offerings row */}
              <tr>
                <td style={{ fontWeight:700, fontSize:'11px' }}>Offerings</td>
                {dates.map(sd => {
                  const dt = dateTotal(sd.date)
                  return (
                    <td key={sd.date} colSpan={isSunday ? 8 : 7} style={{ borderLeft:`2px solid ${color}20` }}>
                      <div style={{ fontSize:'11px', padding:'4px 6px' }}>
                        <div>Tithes: <strong>₦{dt.tithes.toLocaleString()}</strong></div>
                        <div>Special: <strong>₦{dt.special.toLocaleString()}</strong></div>
                      </div>
                    </td>
                  )
                })}
                <td colSpan={isSunday ? 8 : 7} style={{ background:`${color}08` }}>
                  {(() => {
                    const all = dates.flatMap(sd => entries.filter(e => e.service_date === sd.date))
                    const t = all.reduce((s,e)=>s+e.tithes_offering,0)
                    const sp = all.reduce((s,e)=>s+e.special_offering,0)
                    return (
                      <div style={{ fontSize:'11px', padding:'4px 6px' }}>
                        <div>Tithes: <strong>₦{t.toLocaleString()}</strong></div>
                        <div>Special: <strong>₦{sp.toLocaleString()}</strong></div>
                      </div>
                    )
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="shell">
      <Sidebar userRole={userRole} userDistrict={userDistrict} userEmail={userEmail} />
      <div className="main">
        <div className="topbar">
          <Sidebar userRole={userRole} userDistrict={userDistrict} userEmail={userEmail} />
          <div className="topbar-title">
            <h1>Monthly Report</h1>
            <p>{MONTH_NAMES[month-1]} {year} · {submitted.length}/{DISTRICTS.length} districts</p>
          </div>
          <div className="topbar-actions">
            <div className="month-nav">
              <button onClick={prevMonth}>‹</button>
              <span className="month-label">{MONTH_NAMES[month-1]} {year}</span>
              <button onClick={nextMonth}>›</button>
            </div>
            {isAdmin && (
              <button className="btn-primary" onClick={() => router.push('/print')}>
                🖨 Print
              </button>
            )}
          </div>
        </div>

        <div className="page">
          <div className="page-header">
            <h2>{MONTH_NAMES[month-1]} {year} — Group Report</h2>
            <p>Urubi Group · Deeper Life Bible Church</p>
          </div>

          {/* Monthly summary */}
          <div className="stats-grid">
            <div className="stat-card green">
              <div className="stat-label">Total attendance</div>
              <div className="stat-val">{grandTotal.attendance.toLocaleString()}</div>
              <div className="stat-sub">All services combined</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">New comers</div>
              <div className="stat-val">{grandTotal.newComers}</div>
              <div className="stat-sub">Sunday services</div>
            </div>
            <div className="stat-card gold">
              <div className="stat-label">Tithes & Offering</div>
              <div className="stat-val">₦{grandTotal.tithes.toLocaleString()}</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-label">Special Offering</div>
              <div className="stat-val">₦{grandTotal.special.toLocaleString()}</div>
            </div>
          </div>

          {entries.length === 0 && (
            <div className="alert alert-info">
              No reports submitted yet for {MONTH_NAMES[month-1]} {year}. Districts can submit reports from the Entry page.
            </div>
          )}

          {/* Sunday section */}
          {renderSection(sundays, 'sunday')}

          {/* Monday section */}
          {renderSection(mondays, 'monday')}

          {/* Thursday section */}
          {renderSection(thursdays, 'thursday')}
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
