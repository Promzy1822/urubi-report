'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import ToastContainer, { toast } from '@/components/ui/Toast'
import {
  DISTRICTS, District, ServiceEntry, ServiceDay,
  emptyEntry, calcEntry, getServiceDates, getMonthKey,
  MONTH_NAMES, parseMonthKey
} from '@/types'

function Num({ label, value, onChange, ro }: {
  label: string; value: number; onChange?: (v: number) => void; ro?: boolean
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" min={0}
        value={value === 0 && !ro ? '' : value}
        readOnly={ro} placeholder="0"
        onChange={e => onChange?.(parseInt(e.target.value) || 0)}
      />
    </div>
  )
}

const DAY_LABELS: Record<ServiceDay, string> = {
  sunday: '☀ Sunday', monday: '📖 Monday (Bible Study)', thursday: '🔥 Thursday (Revival)'
}

export default function EntryPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState('')
  const [userDistrict, setUserDistrict] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState<District>('OWOSENI')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedDay, setSelectedDay] = useState<ServiceDay>('sunday')
  const [entry, setEntry] = useState<ServiceEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [monthKey, setMonthKey] = useState('')
  const [submittedDates, setSubmittedDates] = useState<string[]>([])

  const now = new Date()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const meta = session.user.user_metadata
      const role = meta.role || ''
      const district = meta.district || 'OWOSENI'
      setUserRole(role)
      setUserDistrict(district)
      setUserEmail(session.user.email || '')
      const active: District = role !== 'admin' ? district : 'OWOSENI'
      setSelectedDistrict(active)
      const mk = getMonthKey(now.getFullYear(), now.getMonth() + 1)
      setMonthKey(mk)
      // Load submitted dates for this district
      await loadSubmitted(active, mk, supabase)
      setLoading(false)
    }
    load()
  }, [router])

  const loadSubmitted = useCallback(async (
    district: District, mk: string,
    client?: ReturnType<typeof createClient>
  ) => {
    const supabase = client || createClient()
    const { data } = await supabase
      .from('service_entries').select('service_date')
      .eq('district', district).eq('month', mk)
    setSubmittedDates((data || []).map((r: ServiceEntry) => r.service_date))
  }, [])

  async function selectDate(date: string, day: ServiceDay) {
    setSelectedDate(date)
    setSelectedDay(day)
    const supabase = createClient()
    const { data } = await supabase
      .from('service_entries').select('*')
      .eq('district', selectedDistrict)
      .eq('service_date', date)
      .limit(1)
    if (data && data.length > 0) {
      setEntry(data[0])
    } else {
      const { year, month } = parseMonthKey(monthKey)
      const d = new Date(date)
      const weekOfMonth = Math.ceil(d.getDate() / 7)
      setEntry(emptyEntry(selectedDistrict, date, day, monthKey, year, weekOfMonth))
    }
  }

  function sf<K extends keyof ServiceEntry>(k: K, v: ServiceEntry[K]) {
    setEntry(prev => prev ? { ...prev, [k]: v } : prev)
  }

  async function save() {
    if (!entry || !selectedDate) { toast('Please select a service date', 'warn'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const payload = { ...entry, district: selectedDistrict, submitted_by: session?.user?.email, submitted_at: new Date().toISOString() }
    const { error } = await supabase.from('service_entries').upsert(payload, { onConflict: 'district,service_date' })
    if (error) toast('Error: ' + error.message, 'error')
    else {
      toast(`${selectedDistrict} — ${selectedDate} saved!`)
      await loadSubmitted(selectedDistrict, monthKey)
    }
    setSaving(false)
  }

  if (loading) return <div className="loader"><div className="spinner" /><p>Loading…</p></div>

  const isAdmin = userRole === 'admin'
  const { year, month } = parseMonthKey(monthKey || getMonthKey(now.getFullYear(), now.getMonth() + 1))
  const serviceDates = getServiceDates(year, month)
  const T = entry ? calcEntry(entry) : null

  const dayColor: Record<ServiceDay, string> = {
    sunday: '#7C3AED', monday: 'var(--blue)', thursday: 'var(--gold)'
  }

  return (
    <div className="shell">
      <Sidebar userRole={userRole} userDistrict={userDistrict} userEmail={userEmail} />
      <div className="main">
        <div className="topbar">
          <Sidebar userRole={userRole} userDistrict={userDistrict} userEmail={userEmail} />
          <div className="topbar-title">
            <h1>Enter Report — {selectedDistrict}</h1>
            <p>{MONTH_NAMES[month - 1]} {year}</p>
          </div>
          <div className="topbar-actions">
            <button onClick={() => router.push('/dashboard')}>← Back</button>
            {entry && selectedDate && (
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : '✓ Save'}
              </button>
            )}
          </div>
        </div>

        <div className="page">
          {/* District selector — admin only */}
          {isAdmin && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-head"><h3>Select District</h3></div>
              <div className="card-body">
                <div className="district-tabs">
                  {DISTRICTS.map(d => (
                    <button key={d} className={`district-tab ${selectedDistrict === d ? 'active' : ''}`}
                      onClick={() => { setSelectedDistrict(d); setSelectedDate(''); setEntry(null); loadSubmitted(d, monthKey) }}>
                      <span className={`dot ${submittedDates.length > 0 ? 'dot-on' : 'dot-off'}`} />
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Service date picker */}
          <div className="card">
            <div className="card-head">
              <h3>Select Service Date</h3>
              <span className="badge badge-blue">{submittedDates.length} of {serviceDates.length} submitted</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {serviceDates.map(sd => {
                  const done = submittedDates.includes(sd.date)
                  const selected = selectedDate === sd.date
                  const color = dayColor[sd.day]
                  return (
                    <button key={sd.date}
                      onClick={() => selectDate(sd.date, sd.day)}
                      style={{
                        padding: '7px 14px', fontSize: '12px', fontWeight: 600,
                        background: selected ? color : done ? `${color}15` : 'white',
                        color: selected ? 'white' : done ? color : 'var(--gray-500)',
                        borderColor: selected ? color : done ? color : 'var(--gray-200)',
                        borderRadius: 'var(--radius)',
                      }}>
                      {done && !selected ? '✓ ' : ''}{sd.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Entry form */}
          {entry && selectedDate && (
            <>
              <div className="card">
                <div className="card-head" style={{ background: `${dayColor[selectedDay]}15`, borderColor: `${dayColor[selectedDay]}30` }}>
                  <h3 style={{ color: dayColor[selectedDay] }}>{DAY_LABELS[selectedDay]}</h3>
                  <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{selectedDate}</span>
                </div>
                <div className="card-body">
                  {/* HCF — Sunday only */}
                  {selectedDay === 'sunday' && (
                    <>
                      <div className="section-title">📋 HCF Report</div>
                      <div className="grid-3">
                        <Num label="No. of HCF" value={entry.hcf_count || 0} onChange={v => sf('hcf_count', v)} />
                        <Num label="No. Present" value={entry.hcf_present || 0} onChange={v => sf('hcf_present', v)} />
                        <Num label="New Comers" value={entry.hcf_new_comers || 0} onChange={v => sf('hcf_new_comers', v)} />
                      </div>
                      <hr className="section-divider" />
                    </>
                  )}

                  {/* Adults */}
                  <div className="section-title">👥 Adults</div>
                  <div className="grid-3">
                    <Num label="Men" value={entry.adult_men} onChange={v => sf('adult_men', v)} />
                    <Num label="Women" value={entry.adult_women} onChange={v => sf('adult_women', v)} />
                    <Num label="Total" value={T?.adults || 0} ro />
                  </div>

                  {/* Youth */}
                  <div className="section-title" style={{ marginTop: '0.875rem' }}>🧑 Youth</div>
                  <div className="grid-3">
                    <Num label="Boys" value={entry.youth_boys} onChange={v => sf('youth_boys', v)} />
                    <Num label="Girls" value={entry.youth_girls} onChange={v => sf('youth_girls', v)} />
                    <Num label="Total" value={T?.youth || 0} ro />
                  </div>

                  {/* Children */}
                  <div className="section-title" style={{ marginTop: '0.875rem' }}>👦 Children</div>
                  <div className="grid-3">
                    <Num label="Boys" value={entry.children_boys} onChange={v => sf('children_boys', v)} />
                    <Num label="Girls" value={entry.children_girls} onChange={v => sf('children_girls', v)} />
                    <Num label="Total" value={T?.children || 0} ro />
                  </div>

                  {/* Subtotal — Sunday only */}
                  {selectedDay === 'sunday' && T && (
                    <div className="subtotal-box">
                      <span>Sub-Total (All Attendance)</span>
                      <strong>{T.subtotal}</strong>
                    </div>
                  )}

                  {/* Offerings */}
                  <hr className="section-divider" />
                  <div className="section-title">💰 Offerings</div>
                  <div className="grid-2">
                    <div className="offering-box">
                      <label>Tithes & Offering (₦)</label>
                      <input type="number" min={0}
                        value={entry.tithes_offering === 0 ? '' : entry.tithes_offering}
                        placeholder="0"
                        onChange={e => sf('tithes_offering', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="offering-box">
                      <label>Special Offering (₦)</label>
                      <input type="number" min={0}
                        value={entry.special_offering === 0 ? '' : entry.special_offering}
                        placeholder="0"
                        onChange={e => sf('special_offering', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
                <div className="card-footer">
                  <button onClick={() => { setSelectedDate(''); setEntry(null) }}>Cancel</button>
                  <button className="btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 28px' }}>
                    {saving ? 'Saving…' : '✓ Save Report'}
                  </button>
                </div>
              </div>
            </>
          )}

          {!selectedDate && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
              <div style={{ fontSize: '40px', marginBottom: '0.75rem' }}>📅</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gray-600)' }}>Select a service date above</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Choose any Sunday, Monday, or Thursday to enter the report</div>
            </div>
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
