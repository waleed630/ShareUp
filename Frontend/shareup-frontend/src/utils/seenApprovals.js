// Which approved rentals the borrower has already seen on My Rentals (per user, per browser)
const key = userId => `seenApprovals:${userId}`

const read = userId => {
  try {
    const ids = JSON.parse(localStorage.getItem(key(userId)))
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

const approvedIds = rentals => rentals.filter(r => r.status === 'APPROVED').map(r => r.id)

export const hasUnseenApproval = (userId, rentals) => {
  const seen = read(userId)
  return approvedIds(rentals).some(id => !seen.includes(id))
}

export const markApprovalsSeen = (userId, rentals) => {
  try {
    localStorage.setItem(key(userId), JSON.stringify(approvedIds(rentals)))
    return true
  } catch {
    // storage unavailable — the dot just stays
    return false
  }
}
