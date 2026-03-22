'use client'
import { SyncStatus } from '@/hooks/useOfflineSync'

interface Props {
  status: SyncStatus
  pendingCount: number
  onSync: () => void
}

const config: Record<SyncStatus, { label: string; color: string; bg: string; icon: string }> = {
  online:  { label: 'Online',   color: '#0F6E56', bg: '#E1F5EE', icon: '●' },
  offline: { label: 'Offline',  color: '#DC2626', bg: '#FEE2E2', icon: '○' },
  syncing: { label: 'Syncing…', color: '#D97706', bg: '#FEF3C7', icon: '↻' },
  synced:  { label: 'Synced',   color: '#2563EB', bg: '#EFF6FF', icon: '✓' },
}

export default function SyncIndicator({ status, pendingCount, onSync }: Props) {
  const c = config[status]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Status pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px', borderRadius: '20px',
        background: c.bg, color: c.color,
        fontSize: '11px', fontWeight: 700,
        border: `1px solid ${c.color}30`,
      }}>
        <span style={{
          display: 'inline-block',
          animation: status === 'syncing' ? 'spin 0.8s linear infinite' : 'none',
        }}>
          {c.icon}
        </span>
        {c.label}
        {pendingCount > 0 && status !== 'syncing' && (
          <span style={{
            background: '#DC2626', color: 'white',
            borderRadius: '10px', padding: '0 5px', fontSize: '10px', fontWeight: 800,
          }}>
            {pendingCount}
          </span>
        )}
      </div>

      {/* Sync button when pending */}
      {pendingCount > 0 && status === 'online' && (
        <button onClick={onSync} style={{
          fontSize: '11px', padding: '4px 10px',
          background: '#0F6E56', color: 'white',
          border: 'none', borderRadius: '20px', cursor: 'pointer',
          fontWeight: 700,
        }}>
          Sync now
        </button>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
