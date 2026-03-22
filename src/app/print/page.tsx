'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import ToastContainer from '@/components/ui/Toast'
import {
  DISTRICTS, District, ServiceEntry,
  calcEntry, getServiceDates, getMonthKey,
  MONTH_NAMES, parseMonthKey
} from '@/types'

export default function PrintPage() {
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
    async function fetch() {
      const mk = getMonthKey(year, month)
      const supabase = createClient()
      const { data } = await supabase
        .from('service_entries').select('*')
        .eq('month', mk).order('service_date', { ascending: true })
      setEntries(data || [])
    }
    if (!loading) fetch()
  }, [year, month, loading])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  if (loading) return <div className="loader"><div className="spinner" /><p>Loading…</p></div>

  const serviceDates = getServiceDates(year, month)
  const sundays = serviceDates.filter(s => s.day === 'sunday')
  const mondays = serviceDates.filter(s => s.day === 'monday')
  const thursdays = serviceDates.filter(s => s.day === 'thursday')

  const getEntry = (district: District, date: string) =>
    entries.find(e => e.district === district && e.service_date === date)

  // Fixed table cell styles
  const th: React.CSSProperties = {
    border: '1px solid #000', padding: '2px 2px',
    textAlign: 'center', background: '#f0f0f0',
    fontWeight: 700, fontSize: '7px', lineHeight: 1.2,
    fontFamily: 'Arial, sans-serif',
  }
  const td: React.CSSProperties = {
    border: '1px solid #000', padding: '2px 2px',
    textAlign: 'center', fontSize: '7.5px',
    fontFamily: 'Arial, sans-serif', lineHeight: 1.3,
  }
  const tdL: React.CSSProperties = { ...td, textAlign: 'left', fontWeight: 700, paddingLeft: '3px', minWidth: '55px' }
  const tdB: React.CSSProperties = { ...td, fontWeight: 700, background: '#f8f8f8' }
  const tfTd: React.CSSProperties = { ...td, fontWeight: 700, background: '#f0f0f0' }
  const Z = (n: number | undefined) => n || ''

  // Totals across all districts for a given date
  const dt = (date: string) => {
    const de = entries.filter(e => e.service_date === date)
    return {
      adM: de.reduce((s,e)=>s+e.adult_men,0),
      adW: de.reduce((s,e)=>s+e.adult_women,0),
      yuB: de.reduce((s,e)=>s+e.youth_boys,0),
      yuG: de.reduce((s,e)=>s+e.youth_girls,0),
      chB: de.reduce((s,e)=>s+e.children_boys,0),
      chG: de.reduce((s,e)=>s+e.children_girls,0),
      tithes: de.reduce((s,e)=>s+e.tithes_offering,0),
      special: de.reduce((s,e)=>s+e.special_offering,0),
    }
  }

  // Grand totals
  const grand = {
    tithes: entries.reduce((s,e)=>s+e.tithes_offering,0),
    special: entries.reduce((s,e)=>s+e.special_offering,0),
  }

  // Render a section (Sunday / Monday / Thursday)
  const renderSection = (
    dates: typeof sundays,
    label: string,
    isSunday: boolean
  ) => {
    if (dates.length === 0) return null
    const cols = isSunday ? 9 : 7 // M W AdT B G YuT B G ChT [Sub]

    return (
      <>
        {/* Section header */}
        <tr>
          <td style={{ ...th, textAlign: 'left', fontWeight: 800, fontSize: '8px', background: '#e8e8e8' }}
            colSpan={1 + dates.length * cols + cols}>
            {label}
          </td>
        </tr>
        {/* Date headers */}
        <tr>
          <th style={{ ...th, minWidth: '55px' }} rowSpan={2}>District</th>
          {dates.map(sd => (
            <th key={sd.date} style={th} colSpan={cols}>{sd.label}</th>
          ))}
          <th style={{ ...th, background: '#e0e0e0' }} colSpan={cols}>TOTAL</th>
        </tr>
        <tr>
          {dates.map(sd => (
            <th key={sd.date} style={{ ...th, padding: 0 }} colSpan={cols}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                <span style={th}>M</span><span style={th}>W</span><span style={th}>T</span>
                <span style={th}>B</span><span style={th}>G</span><span style={th}>T</span>
                <span style={th}>B</span><span style={th}>G</span>
                {isSunday ? <span style={{...th,fontWeight:800}}>Sub</span> : <span style={th}>T</span>}
              </div>
            </th>
          ))}
          <th style={{ ...th, padding: 0, background: '#e0e0e0' }} colSpan={cols}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              <span style={th}>M</span><span style={th}>W</span><span style={th}>T</span>
              <span style={th}>B</span><span style={th}>G</span><span style={th}>T</span>
              <span style={th}>B</span><span style={th}>G</span>
              {isSunday ? <span style={{...th,fontWeight:800}}>Sub</span> : <span style={th}>T</span>}
            </div>
          </th>
        </tr>

        {/* District rows */}
        {DISTRICTS.map(d => {
          const distEntries = dates.map(sd => getEntry(d, sd.date))
          const dAdM = distEntries.reduce((s,e)=>s+(e?.adult_men||0),0)
          const dAdW = distEntries.reduce((s,e)=>s+(e?.adult_women||0),0)
          const dYuB = distEntries.reduce((s,e)=>s+(e?.youth_boys||0),0)
          const dYuG = distEntries.reduce((s,e)=>s+(e?.youth_girls||0),0)
          const dChB = distEntries.reduce((s,e)=>s+(e?.children_boys||0),0)
          const dChG = distEntries.reduce((s,e)=>s+(e?.children_girls||0),0)
          const dSub = dAdM+dAdW+dYuB+dYuG+dChB+dChG

          return (
            <tr key={d} style={{ height: '16px' }}>
              <td style={tdL}>{d}</td>
              {dates.map(sd => {
                const e = getEntry(d, sd.date)
                const t = e ? calcEntry(e) : null
                return (
                  <td key={sd.date} style={{ ...td, padding: 0 }} colSpan={cols}>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                      <span style={td}>{Z(e?.adult_men)}</span>
                      <span style={td}>{Z(e?.adult_women)}</span>
                      <span style={tdB}>{Z(t?.adults)}</span>
                      <span style={td}>{Z(e?.youth_boys)}</span>
                      <span style={td}>{Z(e?.youth_girls)}</span>
                      <span style={tdB}>{Z(t?.youth)}</span>
                      <span style={td}>{Z(e?.children_boys)}</span>
                      <span style={td}>{Z(e?.children_girls)}</span>
                      {isSunday
                        ? <span style={{...tdB, fontWeight:800}}>{Z(t?.subtotal)}</span>
                        : <span style={tdB}>{Z(t?.children)}</span>
                      }
                    </div>
                  </td>
                )
              })}
              {/* District total */}
              <td style={{ ...td, padding: 0, background: '#f5f5f5' }} colSpan={cols}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  <span style={tfTd}>{Z(dAdM)}</span>
                  <span style={tfTd}>{Z(dAdW)}</span>
                  <span style={tfTd}>{Z(dAdM+dAdW)}</span>
                  <span style={tfTd}>{Z(dYuB)}</span>
                  <span style={tfTd}>{Z(dYuG)}</span>
                  <span style={tfTd}>{Z(dYuB+dYuG)}</span>
                  <span style={tfTd}>{Z(dChB)}</span>
                  <span style={tfTd}>{Z(dChG)}</span>
                  {isSunday
                    ? <span style={{...tfTd,fontWeight:800}}>{Z(dSub)}</span>
                    : <span style={tfTd}>{Z(dChB+dChG)}</span>
                  }
                </div>
              </td>
            </tr>
          )
        })}

        {/* Date totals row */}
        <tr style={{ background: '#f0f0f0' }}>
          <td style={{ ...tfTd, textAlign: 'left' }}>TOTAL</td>
          {dates.map(sd => {
            const t = dt(sd.date)
            return (
              <td key={sd.date} style={{ ...td, padding: 0 }} colSpan={cols}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  <span style={tfTd}>{Z(t.adM)}</span>
                  <span style={tfTd}>{Z(t.adW)}</span>
                  <span style={tfTd}>{Z(t.adM+t.adW)}</span>
                  <span style={tfTd}>{Z(t.yuB)}</span>
                  <span style={tfTd}>{Z(t.yuG)}</span>
                  <span style={tfTd}>{Z(t.yuB+t.yuG)}</span>
                  <span style={tfTd}>{Z(t.chB)}</span>
                  <span style={tfTd}>{Z(t.chG)}</span>
                  {isSunday
                    ? <span style={{...tfTd,fontWeight:800}}>{Z(t.adM+t.adW+t.yuB+t.yuG+t.chB+t.chG)}</span>
                    : <span style={tfTd}>{Z(t.chB+t.chG)}</span>
                  }
                </div>
              </td>
            )
          })}
          {/* Grand total */}
          {(() => {
            const all = dates.flatMap(sd => entries.filter(e => e.service_date === sd.date))
            const adM=all.reduce((s,e)=>s+e.adult_men,0)
            const adW=all.reduce((s,e)=>s+e.adult_women,0)
            const yuB=all.reduce((s,e)=>s+e.youth_boys,0)
            const yuG=all.reduce((s,e)=>s+e.youth_girls,0)
            const chB=all.reduce((s,e)=>s+e.children_boys,0)
            const chG=all.reduce((s,e)=>s+e.children_girls,0)
            const sub=adM+adW+yuB+yuG+chB+chG
            return (
              <td style={{ ...td, padding:0, background:'#e8e8e8' }} colSpan={cols}>
                <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)` }}>
                  <span style={tfTd}>{Z(adM)}</span><span style={tfTd}>{Z(adW)}</span>
                  <span style={tfTd}>{Z(adM+adW)}</span>
                  <span style={tfTd}>{Z(yuB)}</span><span style={tfTd}>{Z(yuG)}</span>
                  <span style={tfTd}>{Z(yuB+yuG)}</span>
                  <span style={tfTd}>{Z(chB)}</span><span style={tfTd}>{Z(chG)}</span>
                  {isSunday
                    ? <span style={{...tfTd,fontWeight:800}}>{Z(sub)}</span>
                    : <span style={tfTd}>{Z(chB+chG)}</span>
                  }
                </div>
              </td>
            )
          })()}
        </tr>

        {/* Offerings row */}
        <tr>
          <td style={{ ...td, textAlign:'left', fontWeight:700, fontSize:'7px' }}>Tithes &amp; Offering</td>
          {dates.map(sd => {
            const t = dt(sd.date)
            return (
              <td key={sd.date} style={{ ...td, textAlign:'left', fontSize:'7px' }} colSpan={cols}>
                T:₦{t.tithes.toLocaleString()} S:₦{t.special.toLocaleString()}
              </td>
            )
          })}
          <td style={{ ...tfTd, textAlign:'left', fontSize:'7px' }} colSpan={cols}>
            {(() => {
              const all = dates.flatMap(sd => entries.filter(e => e.service_date === sd.date))
              const t = all.reduce((s,e)=>s+e.tithes_offering,0)
              const sp = all.reduce((s,e)=>s+e.special_offering,0)
              return `T:₦${t.toLocaleString()} S:₦${sp.toLocaleString()}`
            })()}
          </td>
        </tr>
      </>
    )
  }

  return (
    <div className="shell">
      <Sidebar userRole={userRole} userDistrict={userDistrict} userEmail={userEmail} />
      <div className="main">
        <div className="topbar no-print">
          <Sidebar userRole={userRole} userDistrict={userDistrict} userEmail={userEmail} />
          <div className="topbar-title">
            <h1>Print / Export</h1>
            <p>Monthly report — fixed A4 layout</p>
          </div>
          <div className="topbar-actions">
            <div className="month-nav">
              <button onClick={prevMonth}>‹</button>
              <span className="month-label">{MONTH_NAMES[month-1]} {year}</span>
              <button onClick={nextMonth}>›</button>
            </div>
            <button onClick={() => router.push('/report')}>← Report</button>
            <button className="btn-primary" onClick={() => window.print()}>🖨 Print / PDF</button>
          </div>
        </div>

        <div className="page">
          {/* PRINT TEMPLATE — fixed width, never responsive */}
          <div className="print-page">
            <div className="print-page-inner">

              {/* Header */}
              <div className="print-header">
                <h2>Deeper Life Bible Church — Urubi Group</h2>
                <h3>Monthly Summary Report — {MONTH_NAMES[month-1]} {year}</h3>
              </div>

              {/* Meta */}
              <div className="print-meta">
                <div className="print-meta-item">GROUP: <span>Urubi Group</span></div>
                <div className="print-meta-item">MONTH: <span>{MONTH_NAMES[month-1]} {year}</span></div>
                <div className="print-meta-item">TOTAL TITHES: <span>₦{grand.tithes.toLocaleString()}</span></div>
                <div className="print-meta-item">SPECIAL OFFERING: <span>₦{grand.special.toLocaleString()}</span></div>
              </div>

              {/* Main report table */}
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'Arial, sans-serif', fontSize: '7.5px',
              }}>
                <tbody>
                  {renderSection(sundays, 'SUNDAY WORSHIP SERVICE', true)}
                  {renderSection(mondays, 'BIBLE STUDY (MONDAY)', false)}
                  {renderSection(thursdays, 'REVIVAL / EVANGELISM (THURSDAY)', false)}

                  {/* Grand totals */}
                  <tr>
                    <td style={{ ...th, textAlign:'left', background:'#e0e0e0', fontSize:'8px', fontWeight:800 }}
                      colSpan={100}>
                      MONTHLY GRAND TOTAL
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...td, textAlign:'left', fontWeight:700 }}>TITHES &amp; OFFERING</td>
                    <td style={{ ...td, textAlign:'left' }} colSpan={100}>₦{grand.tithes.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={{ ...td, textAlign:'left', fontWeight:700 }}>SPECIAL OFFERING</td>
                    <td style={{ ...td, textAlign:'left' }} colSpan={100}>₦{grand.special.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={{ ...td, textAlign:'left', fontWeight:700 }}>GROUP PASTOR — SIGNATURE &amp; DATE:</td>
                    <td style={td} colSpan={100}>&nbsp;</td>
                  </tr>
                </tbody>
              </table>

              {/* Legend */}
              <div style={{ marginTop:'6px', fontSize:'8px', color:'#666', fontFamily:'Arial, sans-serif' }}>
                M=Men · W=Women · T=Total · B=Boys · G=Girls · Sub=Sub-Total (Sunday only)
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
