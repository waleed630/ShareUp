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

export default function BorrowerDashboard() {
  const { user } = useAuth()
  const laterKey = `ratingPromptLater:${user?.userId}`

  // { rental, itemName, auto } — auto is true when opened by the dashboard popup
  const [rating, setRating] = useState(null)
  const [rated, setRated]   = useState({})

  // Popup: ask for a rating if a completed rental has none yet
  useEffect(() => {
    if (sessionStorage.getItem(laterKey)) return
    let cancelled = false

    const check = async () => {
      try {
        const res     = await rentalsApi.myRentals()
        const list    = Array.isArray(res.data) ? res.data : []
        const pending = list.find(r => r.status === 'RETURN_APPROVED' && r.rating == null)
        if (!pending || cancelled) return

        const item = await itemsApi.getById(pending.itemId).catch(() => null)
        if (!cancelled) setRating(prev => prev || { rental: pending, itemName: item?.data?.name, auto: true })
      } catch {
        // the popup is optional; My Rentals reports load errors itself
      }
    }

    check()
    return () => { cancelled = true }
  }, [laterKey])

  const openRating = useCallback((rental, itemName) => {
    setRating({ rental, itemName, auto: false })
  }, [])

  const dismissRating = useCallback(() => {
    setRating(prev => {
      if (prev?.auto) sessionStorage.setItem(laterKey, '1')
      return null
    })
  }, [laterKey])

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
