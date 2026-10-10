import axios from 'axios'
import { clearSession } from '../utils/session'

// One axios instance per backend service: attaches the JWT and handles an expired session
export default function createClient(baseURL) {
  const client = axios.create({ baseURL })

  client.interceptors.request.use(config => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  client.interceptors.response.use(
    res => res,
    err => {
      // A 401 only ends the session when a token was sent — a wrong password on the
      // login form is also a 401 and must reach the form
      if (err.response?.status === 401 && err.config?.headers?.Authorization) {
        clearSession()
        window.location.href = '/login'
      }
      return Promise.reject(err)
    }
  )

  return client
}
