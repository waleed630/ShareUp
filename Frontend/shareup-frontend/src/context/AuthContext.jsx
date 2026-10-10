import { useEffect, useState } from 'react'
import authApi from '../api/auth.api'
import { AuthContext } from './auth'
import { saveSession, readSession, clearSession } from '../utils/session'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(readSession())
    setLoading(false)
  }, [])

  const login = async data => {
    const res = await authApi.login(data)
    const { token, role, userId, email } = res.data

    saveSession({ token, role, userId, email })

    setUser({ token, role, userId, email })
    return role
  }

  const logout = () => {
    clearSession()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
