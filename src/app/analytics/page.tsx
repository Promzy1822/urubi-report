'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import ToastContainer from '@/components/ui/Toast'
import {
  DISTRICTS, District, ServiceEntry,
  getMonthKey, MONTH_NAMES
} from '@/types'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// ── AI Trend Engine ────────────────────────────────────────────
interface TrendInsight {
  type: 'growth' | 'decline' | 'stable' | 'warning' | 'achievement'
  title: string
  detail: string
  value?: string
  district?: District
}

function analyzeTrends(monthlyData: MonthData[]): TrendInsight[] {
  const insights: TrendInsight[] = []
  if (monthlyData.length < 2) return insights

  const recent = monthlyData.slice(-3)
  const prev = monthlyData.slice(-6, -3)

  // Overall growth/decline
  const recentAvg = recent.reduce((s, m) => s + m.totalAttendance, 0) / recent.length
  const prevAvg = prev.length > 0 ? prev.reduce((s, m) => s + m.totalAttendance, 0) / prev.length : recentAvg
  const growthPct = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0

  if (growthPct > 10) {
    insights.push({
      type: 'growth',
      title: 'Strong attendance growth',
      detail: `Attendance has grown by ${growthPct.toFixed(1)}% over the last 3 months compared to the previous period.`,
      value: `+${growthPct.toFixed(1)}%`
    })
  } else if (growthPct < -10) {
    insights.push({
      type: 'decline',
      title: 'Attendance declining',
      detail: `Attendance has dropped by ${Math.abs(growthPct).toFixed(1)}% over the last 3 months. Consider outreach efforts.`,
      value: `${growthPct.toFixed(1)}%`
    })
  } else {
    insights.push({
      type: 'stable',
      title: 'Attendance is stable',
      detail: `Attendance has remained consistent with less than 10% change over the last 3 months.`,
      value: `${growthPct > 0 ? '+' : ''}${growthPct.toFixed(1)}%`
    })
  }

  // Best performing district
  const lastMonth = monthlyData[monthlyData.length - 1]
  if (lastMonth) {
    const distEntries = DISTRICTS.map(d => ({
      district: d,
      att: lastMonth.byDistrict[d] || 0
    })).sort((a, b) => b.att - a.att)

    if (distEntries[0].att > 0) {
      insights.push({
        type: 'achievement',
        title: 'Top performing district',
        detail: `${distEntries[0].district} had the highest attendance in ${lastMonth.label} with ${distEntries[0].att.toLocaleString()} members.`,
        district: distEntries[0].district,
        value: distEntries[0].att.toLocaleString()
      })
    }

    // Lowest performing
    const active = distEntries.filter(d => d.att > 0)
    if (active.length > 1) {
      const lowest = active[active.length - 1]
      insights.push({
        type: 'warning',
        title: 'District needs attention',
        detail: `${lowest.district} had the lowest attendance in ${lastMonth.label} with ${lowest.att.toLocaleString()} members. Consider additional support.`,
        district: lowest.district,
        value: lowest.att.toLocaleString()
      })
    }
  }

  // New comers trend
  const recentNew = recent.reduce((s, m) => s + m.newComers, 0)
  const prevNew = prev.reduce((s, m) => s + m.newComers, 0)
  if (recentNew > prevNew && prevNew > 0) {
    insights.push({
      type: 'growth',
      title: 'New comers increasing',
      detail: `${recentNew} new comers joined in the last 3 months, up from ${prevNew} in the previous period. Evangelism is effective!`,
      value: `+${recentNew - prevNew}`
    })
  }

  // Offering trend
  const recentOff = recent.reduce((s, m) => s + m.totalOffering, 0)
  const prevOff = prev.length > 0 ? prev.reduce((s, m) => s + m.totalOffering, 0) : recentOff
  const offGrowth = prevOff > 0 ? ((recentOff - prevOff) / prevOff) * 100 : 0
  if (offGrowth > 15) {
    insights.push({
      type: 'achievement',
      title: 'Offering growth',
      detail: `Total offerings grew by ${offGrowth.toFixed(1)}% compared to the previous period. ₦${recentOff.toLocaleString()} collected recently.`,
      value: `+${offGrowth.toFixed(1)}%`
    })
  }

  return insights
}

// ── Forecast next month ────────────────────────────────────────
function forecastNextMonth(monthlyData: MonthData[]): number {
  if (monthlyData.length < 2) return 0
  const last3 = monthlyData.slice(-3)
  const avg = last3.reduce((s, m) => s + m.totalAttendance, 0) / last3.length
  // Simple linear regression slope
  if (last3.length >= 2) {
    const slope = (last3[last3.length-1].totalAttendance - last3[0].totalAttendance) / (last3.length - 1)
    return Math.round(avg + slope * 0.5)
  }
  return Math.round(avg)
}

// ── Types ──────────────────────────────────────────────────────
interface MonthData {
  month: string
  label: string
  totalAttendance: number
  sundayAtt: number
  mondayAtt: number
  thursdayAtt: number
  totalOffering: number
  newComers: number
  byDistrict: Record<string, number>
}

// ── Colors ─────────────────────────────────────────────────────
const DISTRICT_COLORS = ['#0F6E56', '#2563EB', '#D97706', '#7C3AED', '#DC2626']
const DAY_COLORS = { sunday: '#7C3AED', monday: '#2563EB', thursday: '#D97706' }

const insightIcons: Record<string, string> = {
  growth: '📈', decline: '📉', stable: '➡️', warning: '⚠️', achievement: '🏆'
}
const insightColors: Record<string, string> = {
  growth: 'alert-success', decline: 'alert-error', stable: 'alert-info',
  warning: 'alert-warn', achievement: 'alert-success'
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState('')
  const [userDistrict, setUserDistrict] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [allEntries, setAllEntries] = useState<ServiceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'districts' | 'offerings' | 'ai'>('overview')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const meta = session.user.user_metadata
      if (meta.role !== 'admin') { router.push('/dashboard'); return }
      setUserRole(meta.role || '')
      setUserDistrict(meta.district || '')
      setUserEmail(session.user.email || '')

      // Load last 12 months of data
      const { data } = await supabase
        .from('service_entries').select('*')
        .order('service_date', { ascending: true })
      setAllEntries(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  // ── Process monthly data ──────────────────────────────────────
  const monthlyData = useMemo((): MonthData[] => {
    const grouped: Record<string, ServiceEntry[]> = {}
    allEntries.forEach(e => {
      if (!grouped[e.month]) grouped[e.month] = []
      grouped[e.month].push(e)
    })

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, entries]) => {
        const [y, m] = month.split('-')
        const totalAttendance = entries.reduce((s,e) => s+e.adult_men+e.adult_women+e.youth_boys+e.youth_girls+e.children_boys+e.children_girls, 0)
        const sundayAtt = entries.filter(e=>e.service_day==='sunday').reduce((s,e)=>s+e.adult_men+e.adult_women+e.youth_boys+e.youth_girls+e.children_boys+e.children_girls,0)
        const mondayAtt = entries.filter(e=>e.service_day==='monday').reduce((s,e)=>s+e.adult_men+e.adult_women+e.youth_boys+e.youth_girls+e.children_boys+e.children_girls,0)
        const thursdayAtt = entries.filter(e=>e.service_day==='thursday').reduce((s,e)=>s+e.adult_men+e.adult_women+e.youth_boys+e.youth_girls+e.children_boys+e.children_girls,0)
        const totalOffering = entries.reduce((s,e)=>s+e.tithes_offering+e.special_offering,0)
        const newComers = entries.reduce((s,e)=>s+(e.hcf_new_comers||0),0)
        const byDistrict: Record<string, number> = {}
        DISTRICTS.forEach(d => {
          byDistrict[d] = entries.filter(e=>e.district===d).reduce((s,e)=>s+e.adult_men+e.adult_women+e.youth_boys+e.youth_girls+e.children_boys+e.children_girls,0)
        })
        return {
          month, label: `${MONTH_NAMES[parseInt(m)-1].slice(0,3)} ${y}`,
          totalAttendance, sundayAtt, mondayAtt, thursdayAtt,
          totalOffering, newComers, byDistrict
        }
      })
  }, [allEntries])

  // ── District comparison (latest month) ───────────────────────
  const districtData = useMemo(() => {
    const last = monthlyData[monthlyData.length - 1]
    if (!last) return []
    return DISTRICTS.map((d, i) => ({
      name: d, attendance: last.byDistrict[d] || 0,
      color: DISTRICT_COLORS[i]
    })).sort((a,b) => b.attendance - a.attendance)
  }, [monthlyData])

  // ── Pie chart data ────────────────────────────────────────────
  const pieData = useMemo(() => {
    return districtData.filter(d => d.attendance > 0).map(d => ({
      name: d.name, value: d.attendance, color: d.color
    }))
  }, [districtData])

  // ── Service day breakdown ─────────────────────────────────────
  const dayBreakdown = useMemo(() => {
    const last3 = monthlyData.slice(-3)
    return {
      sunday: last3.reduce((s,m)=>s+m.sundayAtt,0),
      monday: last3.reduce((s,m)=>s+m.mondayAtt,0),
      thursday: last3.reduce((s,m)=>s+m.thursdayAtt,0),
    }
  }, [monthlyData])

  // ── AI Insights ───────────────────────────────────────────────
  const insights = useMemo(() => analyzeTrends(monthlyData), [monthlyData])
  const forecast = useMemo(() => forecastNextMonth(monthlyData), [monthlyData])

  // ── Summary stats ─────────────────────────────────────────────
  const lastMonth = monthlyData[monthlyData.length - 1]
  const prevMonth2 = monthlyData[monthlyData.length - 2]
  const attChange = lastMonth && prevMonth2
    ? ((lastMonth.totalAttendance - prevMonth2.totalAttendance) / (prevMonth2.totalAttendance || 1)) * 100
    : 0

  if (loading) return <div className="loader"><div className="spinner" /><p>Loading analytics…</p></div>

  return (
    <div className="shell">
      <Sidebar userRole={userRole} userDistrict={userDistrict} userEmail={userEmail} />
      <div className="main">
        <div className="topbar">
          <Sidebar userRole={userRole} userDistrict={userDistrict} userEmail={userEmail} />
          <div className="topbar-title">
            <h1>Analytics</h1>
            <p>Attendance trends, district performance & AI insights</p>
          </div>
          <div className="topbar-actions">
            <button onClick={() => router.push('/report')}>View Report</button>
            <button className="btn-primary" onClick={() => router.push('/print')}>🖨 Print</button>
          </div>
        </div>

        <div className="page">
          {/* Summary stats */}
          <div className="stats-grid">
            <div className={`stat-card ${attChange >= 0 ? 'green' : 'red'}`}>
              <div className="stat-label">This month attendance</div>
              <div className="stat-val">{(lastMonth?.totalAttendance || 0).toLocaleString()}</div>
              <div className={`stat-trend ${attChange >= 0 ? 'up' : 'down'}`}>
                {attChange >= 0 ? '▲' : '▼'} {Math.abs(attChange).toFixed(1)}% vs last month
              </div>
            </div>
            <div className="stat-card blue">
              <div className="stat-label">Forecasted next month</div>
              <div className="stat-val">{forecast.toLocaleString()}</div>
              <div className="stat-sub">Based on trend analysis</div>
            </div>
            <div className="stat-card gold">
              <div className="stat-label">New comers this month</div>
              <div className="stat-val">{lastMonth?.newComers || 0}</div>
              <div className="stat-sub">Sunday services</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total offerings</div>
              <div className="stat-val">₦{(lastMonth?.totalOffering || 0).toLocaleString()}</div>
              <div className="stat-sub">This month</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="day-tabs" style={{ marginBottom: '1.25rem' }}>
            {(['overview','districts','offerings','ai'] as const).map(tab => (
              <button key={tab} className={`day-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}>
                {tab === 'overview' && '📊 Overview'}
                {tab === 'districts' && '🏘 Districts'}
                {tab === 'offerings' && '💰 Offerings'}
                {tab === 'ai' && '🤖 AI Insights'}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              <div className="card">
                <div className="card-head">
                  <h3>Attendance Trend</h3>
                  <span className="badge badge-green">Last 12 months</span>
                </div>
                <div className="card-body" style={{ height: 300 }}>
                  {monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="totalAttendance" name="Total" stroke="#0F6E56" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="sundayAtt" name="Sunday" stroke={DAY_COLORS.sunday} strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="mondayAtt" name="Monday" stroke={DAY_COLORS.monday} strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="thursdayAtt" name="Thursday" stroke={DAY_COLORS.thursday} strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--gray-400)' }}>
                      No data yet. Submit reports to see trends.
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <h3>Service Day Breakdown</h3>
                  <span className="badge badge-blue">Last 3 months</span>
                </div>
                <div className="card-body">
                  <div className="grid-3">
                    {(['sunday','monday','thursday'] as const).map(day => {
                      const color = DAY_COLORS[day]
                      const val = dayBreakdown[day]
                      const total = dayBreakdown.sunday + dayBreakdown.monday + dayBreakdown.thursday
                      const pct = total > 0 ? (val/total*100).toFixed(1) : '0'
                      return (
                        <div key={day} style={{ textAlign:'center', padding:'1.25rem', background:`${color}10`, borderRadius:'var(--radius-lg)', border:`1px solid ${color}25` }}>
                          <div style={{ fontSize:'11px', fontWeight:700, color, textTransform:'uppercase', marginBottom:'8px' }}>
                            {day === 'sunday' ? '☀ Sunday' : day === 'monday' ? '📖 Monday' : '🔥 Thursday'}
                          </div>
                          <div style={{ fontSize:'28px', fontWeight:800, color }}>{val.toLocaleString()}</div>
                          <div style={{ fontSize:'12px', color:'var(--gray-500)', marginTop:'4px' }}>{pct}% of total</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* DISTRICTS TAB */}
          {activeTab === 'districts' && (
            <>
              <div className="card">
                <div className="card-head">
                  <h3>District Comparison</h3>
                  <span className="badge badge-green">Latest month</span>
                </div>
                <div className="card-body" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={districtData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="attendance" name="Attendance" radius={[4,4,0,0]}>
                        {districtData.map((d, i) => (
                          <Cell key={d.name} fill={DISTRICT_COLORS[i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div className="card">
                  <div className="card-head"><h3>Distribution</h3></div>
                  <div className="card-body" style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                          {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head"><h3>District rankings</h3></div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>#</th><th>District</th><th>Attendance</th><th>Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {districtData.map((d, i) => {
                          const total = districtData.reduce((s,x)=>s+x.attendance,0)
                          const pct = total > 0 ? (d.attendance/total*100).toFixed(1) : '0'
                          return (
                            <tr key={d.name}>
                              <td style={{ fontWeight:700, color: i===0 ? '#D97706' : 'var(--gray-400)' }}>
                                {i===0 ? '🏆' : i+1}
                              </td>
                              <td style={{ fontWeight:600 }}>{d.name}</td>
                              <td>{d.attendance.toLocaleString()}</td>
                              <td>
                                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                  <div style={{ flex:1, height:'6px', background:'var(--gray-100)', borderRadius:'3px', overflow:'hidden' }}>
                                    <div style={{ height:'100%', width:`${pct}%`, background: d.color, borderRadius:'3px' }} />
                                  </div>
                                  <span style={{ fontSize:'11px', color:'var(--gray-500)' }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Monthly trend per district */}
              <div className="card">
                <div className="card-head"><h3>District trends over time</h3></div>
                <div className="card-body" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      {DISTRICTS.map((d, i) => (
                        <Line key={d} type="monotone"
                          dataKey={`byDistrict.${d}`} name={d}
                          stroke={DISTRICT_COLORS[i]} strokeWidth={1.5} dot={{ r: 3 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* OFFERINGS TAB */}
          {activeTab === 'offerings' && (
            <div className="card">
              <div className="card-head">
                <h3>Offerings Trend</h3>
                <span className="badge badge-gold">Last 12 months</span>
              </div>
              <div className="card-body" style={{ height: 320 }}>
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="totalOffering" name="Total Offering" fill="#D97706" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--gray-400)' }}>
                    No offering data yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI INSIGHTS TAB */}
          {activeTab === 'ai' && (
            <>
              <div className="alert alert-info" style={{ marginBottom:'1.25rem' }}>
                <span>🤖</span>
                <div>
                  <strong>AI Trend Analysis</strong> — These insights are automatically generated by analyzing your attendance and offering patterns over time. Data is based on {monthlyData.length} months of records.
                </div>
              </div>

              {/* Forecast card */}
              <div className="card" style={{ marginBottom:'1.25rem' }}>
                <div className="card-head" style={{ background:'#7C3AED15', borderColor:'#7C3AED30' }}>
                  <h3 style={{ color:'#7C3AED' }}>🔮 Attendance Forecast</h3>
                  <span className="badge" style={{ background:'#7C3AED15', color:'#7C3AED' }}>AI Powered</span>
                </div>
                <div className="card-body">
                  <div style={{ display:'flex', alignItems:'center', gap:'2rem', flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontSize:'11px', color:'var(--gray-500)', fontWeight:600, textTransform:'uppercase', marginBottom:'4px' }}>
                        Forecasted next month
                      </div>
                      <div style={{ fontSize:'48px', fontWeight:800, color:'#7C3AED', lineHeight:1 }}>
                        {forecast.toLocaleString()}
                      </div>
                      <div style={{ fontSize:'12px', color:'var(--gray-500)', marginTop:'6px' }}>
                        Based on the last 3 months of attendance data
                      </div>
                    </div>
                    <div style={{ flex:1, minWidth:'200px', height:'120px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[...monthlyData.slice(-3), { label:'Forecast', totalAttendance: forecast }]}>
                          <Line type="monotone" dataKey="totalAttendance" stroke="#7C3AED" strokeWidth={2} dot={{ r: 4 }} strokeDasharray={(i: number) => i === 3 ? '5 3' : '0'} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <Tooltip />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* Insights list */}
              {insights.length === 0 ? (
                <div className="alert alert-info">
                  Not enough data for AI insights yet. Submit at least 2 months of reports to see trends.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {insights.map((insight, i) => (
                    <div key={i} className={`alert ${insightColors[insight.type]}`}>
                      <span style={{ fontSize:'20px' }}>{insightIcons[insight.type]}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                          <strong>{insight.title}</strong>
                          {insight.value && (
                            <span style={{ fontSize:'16px', fontWeight:800 }}>{insight.value}</span>
                          )}
                        </div>
                        <div style={{ fontSize:'13px', marginTop:'3px', opacity:0.85 }}>{insight.detail}</div>
                        {insight.district && (
                          <span className="badge badge-green" style={{ marginTop:'6px' }}>{insight.district}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Natural language summary */}
              {monthlyData.length > 0 && (
                <div className="card" style={{ marginTop:'1.25rem' }}>
                  <div className="card-head"><h3>📝 Auto-generated Summary</h3></div>
                  <div className="card-body" style={{ lineHeight:1.8, color:'var(--gray-700)' }}>
                    <p>
                      <strong>Urubi Group — {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()} Report Summary</strong>
                    </p>
                    <br />
                    <p>
                      The group has recorded <strong>{allEntries.length} service entries</strong> across{' '}
                      <strong>{monthlyData.length} months</strong> of data.
                      {lastMonth && ` The most recent month (${lastMonth.label}) saw a total attendance of `}
                      {lastMonth && <strong>{lastMonth.totalAttendance.toLocaleString()} members</strong>}
                      {lastMonth && ` across all service days.`}
                    </p>
                    <br />
                    <p>
                      {districtData[0] && `${districtData[0].name} leads in attendance with ${districtData[0].attendance.toLocaleString()} members this month. `}
                      {lastMonth && `Total offerings collected this month amount to ₦${lastMonth.totalOffering.toLocaleString()}, `}
                      {lastMonth && `with ${lastMonth.newComers} new comers recorded through Sunday services.`}
                    </p>
                    <br />
                    <p>
                      {`Based on current trends, the forecast for next month is approximately `}
                      <strong>{forecast.toLocaleString()} members</strong>.
                      {attChange > 0
                        ? ` The group is experiencing positive growth of ${attChange.toFixed(1)}% month-over-month.`
                        : attChange < 0
                        ? ` Attendance has declined by ${Math.abs(attChange).toFixed(1)}% compared to last month. Targeted outreach is recommended.`
                        : ` Attendance has remained stable compared to last month.`
                      }
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
