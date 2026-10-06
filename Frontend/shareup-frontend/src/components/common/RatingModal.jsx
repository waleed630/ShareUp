import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import ratingsApi from '../../api/ratings.api'

const MAX_STARS = 10
const MAX_REVIEW = 1000

export default function RatingModal({ rental, itemName, dismissLabel = 'Cancel', onDismiss, onRated }) {
  const [stars, setStars]   = useState(0)
  const [hover, setHover]   = useState(0)
  const [review, setReview] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !saving) onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onDismiss])

  const submit = async e => {
    e.preventDefault()
    if (stars < 1) { toast.error('Please select a rating first'); return }

    setSaving(true)
    try {
      const res = await ratingsApi.rate(rental.id, { stars, review: review.trim() || null })
      toast.success('Thanks for your rating!')
      onRated(res.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit rating')
      setSaving(false)
    }
  }

  const shown = hover || stars

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        .rm-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .rm-card {
          font-family: 'DM Sans', sans-serif;
          background: white; border-radius: 16px; padding: 24px;
          width: 100%; max-width: 420px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.25);
          display: flex; flex-direction: column; gap: 14px;
        }
        .rm-title { font-family: 'Syne', sans-serif; font-size: 1.2rem; font-weight: 800; color: #111; letter-spacing: -0.3px; }
        .rm-sub { font-size: 0.85rem; color: #6b7280; margin-top: 4px; }
        .rm-sub strong { color: #374151; }
        .rm-stars { display: flex; flex-wrap: wrap; gap: 2px; }
        .rm-star {
          background: none; border: none; padding: 2px; cursor: pointer;
          font-size: 1.7rem; line-height: 1; color: #e5e0d8; transition: color 0.12s, transform 0.12s;
        }
        .rm-star.is-on { color: #f59e0b; }
        .rm-star:hover { transform: scale(1.15); }
        .rm-score { font-size: 0.8rem; color: #6b7280; min-height: 1.1em; }
        .rm-review {
          width: 100%; min-height: 84px; resize: vertical;
          border: 1.5px solid #e5e0d8; border-radius: 10px; padding: 10px 12px;
          font-family: 'DM Sans', sans-serif; font-size: 0.85rem; color: #111; outline: none;
        }
        .rm-review:focus { border-color: #e85d26; }
        .rm-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .rm-btn {
          padding: 9px 18px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.18s;
        }
        .rm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .rm-btn-later { border: 1.5px solid #e5e0d8; background: white; color: #6b7280; }
        .rm-btn-later:hover:not(:disabled) { border-color: #9ca3af; color: #374151; }
        .rm-btn-submit { border: none; background: #111; color: white; }
        .rm-btn-submit:hover:not(:disabled) { background: #e85d26; }
      `}</style>

      <div className="rm-overlay">
        <form className="rm-card" role="dialog" aria-modal="true" aria-labelledby="rm-title" onSubmit={submit}>
          <div>
            <div className="rm-title" id="rm-title">Rate the owner</div>
            <div className="rm-sub">
              How was your rental{itemName ? <> of <strong>{itemName}</strong></> : ''}?
            </div>
          </div>

          <div>
            <div className="rm-stars" onMouseLeave={() => setHover(0)}>
              {[...Array(MAX_STARS)].map((_, i) => {
                const value = i + 1
                return (
                  <button
                    key={value}
                    type="button"
                    className={`rm-star ${value <= shown ? 'is-on' : ''}`}
                    aria-label={`${value} out of ${MAX_STARS}`}
                    aria-pressed={value === stars}
                    onMouseEnter={() => setHover(value)}
                    onClick={() => setStars(value)}
                  >
                    ★
                  </button>
                )
              })}
            </div>
            <div className="rm-score">{shown ? `${shown} / ${MAX_STARS}` : 'Select a rating'}</div>
          </div>

          <textarea
            className="rm-review"
            placeholder="Write a review (optional)"
            maxLength={MAX_REVIEW}
            value={review}
            onChange={e => setReview(e.target.value)}
          />

          <div className="rm-actions">
            <button type="button" className="rm-btn rm-btn-later" disabled={saving} onClick={onDismiss}>
              {dismissLabel}
            </button>
            <button type="submit" className="rm-btn rm-btn-submit" disabled={saving}>
              {saving ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
