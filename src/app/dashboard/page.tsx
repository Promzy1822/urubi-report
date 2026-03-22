'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import ToastContainer from '@/components/ui/Toast'
import { DISTRICTS, ServiceEntry, getMonthKey, MONTH_NAMES, getServiceDates } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState('')
  const [userDistrict, setUserDistrict] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [entries, setEntries] = useState<ServiceEntry[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const currentMonth = getMonthKey(now.getFullYear(), now.getMonth() + 1)
  const monthName = MONTH_NAMES[now.getMonth()]
  const year = now.getFullYear()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const meta = session.user.user_metadata
      setUserRole(meta.role || '')
      setUserDistrict(meta.district || '')
      setUserEmail(session.user.email || '')
      const { data } = await supabase
        .from('service_entries').select('*')
        .eq('month', currentMonth)
        .order('service_date', { ascending: true })
      setEntries(data || [])
      setLoading(false)
    }
    load()
  }, [router, currentMonth])

  if (loading) return <div className="loader"><div className="spinner" /><p>Loading…</p></div>

  const isAdmin = userRole === 'admin'

  // Service dates this month
  const serviceDates = getServiceDates(now.getFullYear(), now.getMonth() + 1)
  const totalExpected = isAdmin
    ? serviceDates.length * DISTRICTS.length
    : serviceDates.length

  const myEntries = isAdmin ? entries : entries.filter(e => e.district === userDistrict)
  const submitted = myEntries.length
  const submittedDistricts = Array.from(new Set(entries.map(e => e.district)))

  // Totals
  const totalAttendance = entries.reduce((s, e) => s + e.adult_men + e.adult_women + e.youth_boys + e.youth_girls + e.children_boys + e.children_girls, 0)
  const totalOffering = entries.reduce((s, e) => s + e.tithes_offering + e.special_offering, 0)
  const totalNew = entries.reduce((s, e) => s + (e.hcf_new_comers || 0), 0)

  // Completion %
  const pct = totalExpected > 0 ? Math.round((submitted / totalExpected) * 100) : 0

  // Missing districts
  const missingDistricts = DISTRICTS.filter(d => !submittedDistricts.includes(d))

  return (
    <div className="shell">
      <Sidebar userRole={userRole} userDistrict={userDistrict} userEmail={userEmail} />
      <div className="main">
        <div className="topbar">
          <Sidebar userRole={userRole} userDistrict={userDistrict} userEmail={userEmail} />
          <div className="topbar-title">
            <h1>Dashboard</h1>
            <p>{monthName} {year} · {isAdmin ? 'Group Pastor View' : `${userDistrict} District`}</p>
          </div>
          <div className="topbar-actions">
            {isAdmin && <button onClick={() => router.push('/report')}>View Report</button>}
            <button className="btn-primary" onClick={() => router.push('/entry')}>
              Enter Report →
            </button>
          </div>
        </div>

        <div className="page">
          <div className="page-header">
            <h2>Welcome{userDistrict ? `, ${userDistrict} District` : ''} 👋</h2>
            <p>Here is the summary for {monthName} {year}</p>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className={`stat-card ${pct === 100 ? 'green' : ''}`}>
              <div className="stat-label">Reports submitted</div>
              <div className="stat-val">{submitted}</div>
              <div className="stat-sub">of {totalExpected} expected</div>
              <div className="progress-bar" style={{ marginTop: '8px' }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="stat-card blue">
              <div className="stat-label">Total attendance</div>
              <div className="stat-val">{totalAttendance.toLocaleString()}</div>
              <div className="stat-sub">{monthName}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">New comers</div>
              <div className="stat-val">{totalNew}</div>
              <div className="stat-sub">This month</div>
            </div>
            <div className="stat-card gold">
              <div className="stat-label">Total offerings</div>
              <div className="stat-val">₦{totalOffering.toLocaleString()}</div>
              <div className="stat-sub">Tithes + Special</div>
            </div>
          </div>

          {/* Missing districts alert */}
          {isAdmin && missingDistricts.length > 0 && (
            <div className="alert alert-warn">
              <span>⚠</span>
              <div>
                <strong>Missing reports:</strong> {missingDistricts.join(', ')} {missingDistricts.length === 1 ? 'has' : 'have'} not submitted any report this month.
              </div>
            </div>
          )}

          {/* District status */}
          {isAdmin && (
            <div className="card">
              <div className="card-head">
                <div>
                  <h3>District Submission Status</h3>
                  <p>{monthName} {year}</p>
                </div>
                <span className="badge badge-green">{submittedDistricts.length}/{DISTRICTS.length} districts</span>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>District</th>
                      <th>Services submitted</th>
                      <th>Total attendance</th>
                      <th>New comers</th>
                      <th>Offerings</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DISTRICTS.map(d => {
                      const de = entries.filter(e => e.district === d)
                      const att = de.reduce((s,e) => s+e.adult_men+e.adult_women+e.youth_boys+e.youth_girls+e.children_boys+e.children_girls, 0)
                      const off = de.reduce((s,e) => s+e.tithes_offering+e.special_offering, 0)
                      const nc = de.reduce((s,e) => s+(e.hcf_new_comers||0), 0)
                      return (
                        <tr key={d}>
                          <td style={{ fontWeight: 700 }}>{d}</td>
                          <td>{de.length > 0 ? `${de.length} services` : <span style={{color:'var(--gray-400)'}}>—</span>}</td>
                          <td>{att > 0 ? att.toLocaleString() : <span style={{color:'var(--gray-400)'}}>—</span>}</td>
                          <td>{nc > 0 ? nc : <span style={{color:'var(--gray-400)'}}>—</span>}</td>
                          <td>{off > 0 ? `₦${off.toLocaleString()}` : <span style={{color:'var(--gray-400)'}}>—</span>}</td>
                          <td>
                            {de.length > 0
                              ? <span className="badge badge-green">✓ Active</span>
                              : <span className="badge badge-red">⚠ Missing</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Service dates this month */}
          <div className="card">
            <div className="card-head">
              <h3>Service Calendar — {monthName} {year}</h3>
              <span className="badge badge-blue">{serviceDates.length} service days</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {serviceDates.map(sd => {
                  const hasEntry = isAdmin
                    ? entries.some(e => e.service_date === sd.date)
                    : entries.some(e => e.service_date === sd.date && e.district === userDistrict)
                  const colors = { sunday: '#7C3AED', monday: 'var(--blue)', thursday: 'var(--gold)' }
                  const color = colors[sd.day]
                  return (
                    <div key={sd.date} style={{
                      padding: '6px 12px', borderRadius: 'var(--radius)',
                      border: `1px solid ${color}20`,
                      background: hasEntry ? `${color}15` : 'var(--gray-50)',
                      fontSize: '12px', fontWeight: 600,
                      color: hasEntry ? color : 'var(--gray-400)',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                      <span>{hasEntry ? '✓' : '○'}</span>
                      {sd.label}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
