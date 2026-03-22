'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { DISTRICTS } from '@/types'

interface Props {
  userRole: string
  userDistrict: string
  userEmail: string
  pendingCount?: number
}

const NavItem = ({ href, icon, label, active, badge, onClick }: {
  href?: string; icon: React.ReactNode; label: string
  active?: boolean; badge?: number; onClick?: () => void
}) => (
  <a
    href={href}
    className={`nav-item ${active ? 'active' : ''}`}
    onClick={e => { if (onClick) { e.preventDefault(); onClick() } }}
  >
    {icon}
    <span>{label}</span>
    {badge ? <span className="nav-item-badge">{badge}</span> : null}
  </a>
)

export default function Sidebar({ userRole, userDistrict, userEmail, pendingCount }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isAdmin = userRole === 'admin'

  const go = (path: string) => { router.push(path); setOpen(false) }

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  const initials = userEmail?.slice(0, 2).toUpperCase() || 'U'
  const displayName = isAdmin ? 'Group Pastor' : `${userDistrict} District`

  // Icons
  const IcoMenu = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
  const IcoClose = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
  const IcoDash = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  const IcoEdit = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
  const IcoReport = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
  const IcoPrint = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
  const IcoChart = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
  const IcoOut = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>

  const sidebarContent = (
    <>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">✝</div>
        <div className="sidebar-logo-text">
          <h1>Urubi Group</h1>
          <p>DLBC Report System</p>
        </div>
        <button onClick={() => setOpen(false)} className="btn-ghost" style={{ marginLeft: 'auto', padding: '4px', display: open ? 'flex' : 'none' }} aria-label="Close">
          <IcoClose />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">Main</div>
        <NavItem href="/dashboard" icon={<IcoDash />} label="Dashboard" active={pathname === '/dashboard'} onClick={() => go('/dashboard')} />
        <NavItem href="/entry" icon={<IcoEdit />} label="Enter Report" active={pathname === '/entry'} onClick={() => go('/entry')} badge={pendingCount} />

        {isAdmin && <>
          <div className="nav-section" style={{ marginTop: '0.5rem' }}>Reports</div>
          <NavItem href="/report" icon={<IcoReport />} label="Monthly Report" active={pathname === '/report'} onClick={() => go('/report')} />
          <NavItem href="/print" icon={<IcoPrint />} label="Print / Export" active={pathname === '/print'} onClick={() => go('/print')} />
          <NavItem href="/analytics" icon={<IcoChart />} label="Analytics" active={pathname === '/analytics'} onClick={() => go('/analytics')} />
        </>}

        {!isAdmin && <>
          <div className="nav-section" style={{ marginTop: '0.5rem' }}>Reports</div>
          <NavItem href="/report" icon={<IcoReport />} label="View Report" active={pathname === '/report'} onClick={() => go('/report')} />
        </>}

        {isAdmin && <>
          <div className="nav-section" style={{ marginTop: '0.5rem' }}>Districts</div>
          {DISTRICTS.map(d => (
            <div key={d} className="nav-item" style={{ fontSize: '12px', padding: '0.4rem 1.25rem' }}>
              <span className="dot dot-off" />
              {d}
            </div>
          ))}
        </>}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{displayName}</div>
            <div className="sidebar-user-role">{isAdmin ? 'Administrator' : 'District Rep'}</div>
          </div>
        </div>
        <button onClick={logout} style={{ width: '100%', justifyContent: 'center', color: 'var(--gray-500)', fontSize: '12px' }}>
          <IcoOut /> Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Hamburger — mobile only via CSS */}
      <button className="hamburger" onClick={() => setOpen(true)} aria-label="Menu">
        <IcoMenu />
      </button>

      {/* Dark overlay */}
      <div className={`overlay ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      {/* Sidebar panel */}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {sidebarContent}
      </aside>
    </>
  )
}
