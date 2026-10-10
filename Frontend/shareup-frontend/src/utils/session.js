// Login state kept in localStorage. Other keys (seen approvals, rating prompts) belong to
// the browser, not the session, and must survive a logout.
const KEYS = ['token', 'role', 'userId', 'email']

const decodeToken = token => {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

export const saveSession = ({ token, role, userId, email }) => {
  localStorage.setItem('token', token)
  localStorage.setItem('role', role)
  localStorage.setItem('userId', userId)
  if (email) localStorage.setItem('email', email)
}

export const clearSession = () => KEYS.forEach(key => localStorage.removeItem(key))

// The stored user, or null when nobody is logged in or the token has expired
export const readSession = () => {
  const token  = localStorage.getItem('token')
  const role   = localStorage.getItem('role')
  const userId = localStorage.getItem('userId')
  if (!token || !role || !userId) return null

  const claims = decodeToken(token)
  if (!claims || (claims.exp && claims.exp * 1000 <= Date.now())) {
    clearSession()
    return null
  }

  // sessions saved before the email was stored still have it inside the token
  return { token, role, userId, email: localStorage.getItem('email') || claims.email || '' }
}
