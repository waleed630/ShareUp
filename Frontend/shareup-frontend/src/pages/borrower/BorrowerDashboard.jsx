import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import BorrowerLayout from '../../components/layout/BorrowerLayout'
import RatingModal from '../../components/common/RatingModal'
import rentalsApi from '../../api/rentals.api'
import itemsApi from '../../api/items.api'
import useAuth from '../../hooks/useAuth'
import BrowseItems from './BrowseItems'
import MyRentals from './MyRentals'
import ItemDetails from './ItemDetails'

// Completed rentals the rating popup has already been shown for (per user, per browser)
const readPrompted = key => {
  try {
    const ids = JSON.parse(localStorage.getItem(key))
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

export default function BorrowerDashboard() {
  const { user } = useAuth()
  const promptedKey = `ratingPrompted:${user?.userId}`

  // { rental, itemName, auto } — auto is true when opened by the dashboard popup
  const [rating, setRating] = useState(null)
  const [rated, setRated]   = useState({})

  // Popup: ask for a rating once, when the owner approves a return — not on every login
  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res      = await rentalsApi.myRentals()
        const list     = Array.isArray(res.data) ? res.data : []
        const unrated  = list.filter(r => r.status === 'RETURN_APPROVED' && r.rating == null)
        const prompted = readPrompted(promptedKey)
        const pending  = unrated.find(r => !prompted.includes(r.id))
        if (!pending || cancelled) return

        // without storage the popup would come back on every check, so skip it
        try {
          localStorage.setItem(promptedKey, JSON.stringify(unrated.map(r => r.id)))
        } catch {
          return
        }

        const item = await itemsApi.getById(pending.itemId).catch(() => null)
        if (!cancelled) setRating(prev => prev || { rental: pending, itemName: item?.data?.name, auto: true })
      } catch {
        // the popup is optional; My Rentals reports load errors itself
      }
    }

    check()
    const timer = setInterval(check, 20000)
    window.addEventListener('focus', check)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [promptedKey])

  const openRating = useCallback((rental, itemName) => {
    setRating({ rental, itemName, auto: false })
  }, [])

  const dismissRating = useCallback(() => setRating(null), [])

  const handleRated = updated => {
    setRated(prev => ({ ...prev, [updated.id]: updated.rating }))
    setRating(null)
  }

  return (
    <BorrowerLayout>
      <Routes>
        <Route path="/" element={<Navigate to="browse" />} />
        <Route path="browse" element={<BrowseItems />} />
        <Route path="rentals" element={<MyRentals rated={rated} onRate={openRating} />} />
        <Route path="items/:id" element={<ItemDetails />} />


      </Routes>

      {rating && (
        <RatingModal
          key={rating.rental.id}
          rental={rating.rental}
          itemName={rating.itemName}
          dismissLabel={rating.auto ? 'Later' : 'Cancel'}
          onDismiss={dismissRating}
          onRated={handleRated}
        />
      )}

    </BorrowerLayout>
  )
}
