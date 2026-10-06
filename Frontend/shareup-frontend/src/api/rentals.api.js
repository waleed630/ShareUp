import rentalAxios from './rentalAxios'

// YYYY-MM-DD in local time (backend expects LocalDate)
const fmt = d => d.toLocaleDateString('en-CA')

const defaultDates = () => {
  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 7)
  return { startDate: fmt(start), endDate: fmt(end) }
}

// Fired on window after the owner approves / rejects a request or a return, so the sidebar dots update at once
export const RENTALS_CHANGED = 'rentals:changed'

// Fired on window when the borrower has an approved rental they have not seen yet
export const RENTAL_APPROVED = 'rentals:approved'

export default {
  // Borrower — submit rental request with dates
  request: data => rentalAxios.post('/api/rentals/request', { ...defaultDates(), ...data }),

  // Borrower — cancel a PENDING request
  cancel: id => rentalAxios.put(`/api/rentals/${id}/cancel`),

  // Owner — approve / reject
  approve: id => rentalAxios.put(`/api/rentals/approve/${id}`),
  reject:  id => rentalAxios.put(`/api/rentals/reject/${id}`),

  // Items held by a pending request — [{ itemId, startDate, endDate, mine }]
  reservations: () => rentalAxios.get('/api/rentals/reservations'),

  // Borrower — my rentals list
  myRentals: () => rentalAxios.get('/api/rentals/me'),

  // Owner — incoming requests
  getOwnerRequests: () => rentalAxios.get('/api/rentals/owner'),

  // Owner — pending return approvals
  getPendingReturns: () => rentalAxios.get('/api/rentals/owner/returns'),

  // Borrower — submit return with image proof
  returnItem: (id, file) => {
    const fd = new FormData()
    fd.append('image', file)
    return rentalAxios.post(`/api/rentals/${id}/return`, fd)
  },

  // Owner — approve return
  approveReturn: id => rentalAxios.put(`/api/rentals/approve-return/${id}`),
}