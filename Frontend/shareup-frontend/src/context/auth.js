import { createContext } from 'react'

// Value: { user, login, logout, loading } — provided by AuthProvider in AuthContext.jsx
export const AuthContext = createContext(null)
