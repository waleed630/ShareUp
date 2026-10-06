import { useState } from 'react'
import toast from 'react-hot-toast'

const today = new Date().toISOString().split('T')[0]

const daysBetween = (start, end) => Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24))

// Date picker shown before a rental request is sent — onConfirm({ startDate, endDate })
export default function RentalDatesModal({ item, onCancel, onConfirm }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')

  const confirm = () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates')
      return
    }
    if (endDate <= startDate) {
      toast.error('End date must be after start date')
      return
    }
    onConfirm({ startDate, endDate })
  }

  return (
    <>
      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal-box { font-family: 'DM Sans', sans-serif; background: white; border-radius: 20px; padding: 28px; width: 100%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .modal-title { font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 800; color: #111; margin-bottom: 4px; }
        .modal-sub { font-size: 0.82rem; color: #9ca3af; margin-bottom: 20px; }
        .date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .date-group label { display: block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #374151; margin-bottom: 6px; }
        .date-input { width: 100%; border: 1.5px solid #e5e0d8; border-radius: 9px; padding: 9px 12px; font-size: 0.875rem; font-family: 'DM Sans', sans-serif; color: #111; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .date-input:focus { border-color: #e85d26; }
        .modal-btns { display: flex; gap: 10px; }
        .btn-cancel-modal { flex: 1; padding: 11px; border-radius: 9px; border: 1.5px solid #e5e0d8; background: white; font-size: 0.875rem; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.18s; color: #374151; }
        .btn-cancel-modal:hover { border-color: #111; }
        .btn-confirm { flex: 1; padding: 11px; border-radius: 9px; border: none; background: #e85d26; color: white; font-size: 0.875rem; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.18s; }
        .btn-confirm:hover { background: #d44d1a; }
      `}</style>

      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
        <div className="modal-box">
          <div className="modal-title">Select Rental Dates</div>
          <div className="modal-sub">
            Requesting: <strong>{item.name}</strong> · PKR {item.price}/day
          </div>

          <div className="date-row">
            <div className="date-group">
              <label>Start Date *</label>
              <input type="date" className="date-input" min={today} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="date-group">
              <label>End Date *</label>
              <input type="date" className="date-input" min={startDate || today} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Total cost preview */}
          {startDate && endDate && endDate > startDate && (
            <div style={{ background: '#fef3ec', border: '1px solid #fbd5bf', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: '#7c3b1a' }}>
              📅 {daysBetween(startDate, endDate)} days
              &nbsp;·&nbsp;
              Total: <strong>PKR {daysBetween(startDate, endDate) * item.price}</strong>
            </div>
          )}

          <div className="modal-btns">
            <button className="btn-cancel-modal" onClick={onCancel}>Cancel</button>
            <button className="btn-confirm" onClick={confirm}>Confirm Request</button>
          </div>
        </div>
      </div>
    </>
  )
}
