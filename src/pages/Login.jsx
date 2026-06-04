import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { signIn, user }        = useAuth()
  const navigate                = useNavigate()
  const location                = useLocation()
  const from                    = location.state?.from?.pathname ?? '/dashboard'

  // Already logged in → redirect
  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user, navigate, from])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: signInError } = await signIn(email.trim(), password)
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : signInError.message)
      setLoading(false)
    }
    // On success, useEffect above handles redirect
  }

  return (
    <div className="login-page">

      {/* ── LEFT: Brand panel ── */}
      <div className="login-brand">
        <div className="login-brand-content">
          <div className="login-logo-wrap">
            <img
              src="/logo.png"
              alt="TPS Xperts Global Certification"
              className="login-logo"
            />
          </div>

          <h1>TPS Cert Portal</h1>
          <p>TPS Xperts Global Certification Pvt Ltd</p>

          <div className="login-badges">
            <span className="badge-pill">NABCB Accredited</span>
            <span className="badge-pill">ISO 22000:2018</span>
            <span className="badge-pill">ISO/IEC 17021-1</span>
          </div>

          <div className="login-info">
            <div className="login-info-item">
              <span className="info-label">Accreditation Date</span>
              <span className="info-value">15 May 2026</span>
            </div>
            <div className="login-info-item">
              <span className="info-label">Accreditation Body</span>
              <span className="info-value">NABCB, India</span>
            </div>
            <div className="login-info-item">
              <span className="info-label">Scope</span>
              <span className="info-value">Food Safety Management Systems</span>
            </div>
            <div className="login-info-item">
              <span className="info-label">Certified Clients</span>
              <span className="info-value">4 active certifications</span>
            </div>
          </div>
        </div>

        <div className="login-brand-footer">
          <p>© 2026 TPS Xperts Global Certification Pvt Ltd</p>
          <p style={{ marginTop: 4 }}>Mohali, Punjab, India</p>
        </div>
      </div>

      {/* ── RIGHT: Login form ── */}
      <div className="login-form-panel">
        <div className="login-form-wrap">

          <div style={{ marginBottom: 32 }}>
            <h2>Sign In</h2>
            <p className="login-subtitle">
              Authorized TPS team member access only
            </p>
          </div>

          {error && <div className="alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: 28 }}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Signing in…
                </>
              ) : 'Sign In →'}
            </button>
          </form>

          <p className="login-note">
            Access is restricted to authorized TPS Xperts team members.
            Contact <strong>Tarun Pratap Singh</strong> (Director) for account access.
          </p>

        </div>
      </div>

    </div>
  )
}
