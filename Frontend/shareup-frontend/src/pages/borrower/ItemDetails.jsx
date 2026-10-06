import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import itemsApi from '../../api/items.api'
import rentalsApi from '../../api/rentals.api'
import toast from 'react-hot-toast'
import RentalDatesModal from '../../components/common/RentalDatesModal'

export default function ItemDetails() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  // Pending request holding this item — { mine, endDate } or null
  const [held, setHeld] = useState(null)
  const [pickingDates, setPickingDates] = useState(false)

  const loadHeld = async () => {
    const res = await rentalsApi.reservations().catch(() => null)
    const list = Array.isArray(res?.data) ? res.data : []
    setHeld(list.find(r => r.itemId === id) || null)
  }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await itemsApi.getById(id)
        setItem(res.data)
        await loadHeld()
      } catch {
        toast.error('Failed to load item')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  const requestRental = async ({ startDate, endDate }) => {
    setPickingDates(false)
    try {
      await rentalsApi.request({
        itemId: item.id || item._id,
        ownerId: item.ownerId,
        startDate,
        endDate
      })
      toast.success('Rental request sent')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed')
    }
    loadHeld()
  }

  if (loading) return <p>Loading...</p>
  if (!item) return <p>Item not found</p>

 const imageUrl = item.imageUrl || '/placeholder.png'


  return (
    <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow">

      <div className="grid md:grid-cols-2 gap-8 items-start">

        {/* IMAGE */}
        <div className="w-full max-w-md aspect-square bg-gray-100 flex items-center justify-center overflow-hidden rounded-lg mx-auto">
          <img
            src={imageUrl}
            alt={item.name}
            className="max-w-full max-h-full object-contain"
            onError={e => (e.currentTarget.src = '/placeholder.png')}
          />
        </div>

        {/* DETAILS */}
        <div className="space-y-4">

          <h1 className="text-2xl font-bold">{item.name}</h1>

          <p className="text-gray-600">{item.description}</p>

          <div className="space-y-2 text-sm">
            <div>
              <b>Price:</b> PKR {item.price}
            </div>

            <div>
              <b>Status:</b> {item.status}
            </div>

            <div>
              <b>Pickup Address:</b> {item.pickupAddress || 'Not provided'}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => navigate(-1)}
              className="border px-4 py-2 rounded"
            >
              Back
            </button>

            <button
              onClick={() => setPickingDates(true)}
              disabled={!!held}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {held?.mine ? 'Requested' : held ? 'Reserved' : 'Request Rental'}
            </button>
          </div>

          {held && (
            <p className="text-sm text-amber-700">
              {held.mine
                ? 'Waiting for owner approval.'
                : `Reserved · Expected until ${held.endDate ? new Date(held.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}`}
            </p>
          )}

        </div>
      </div>

      {pickingDates && (
        <RentalDatesModal item={item} onCancel={() => setPickingDates(false)} onConfirm={requestRental} />
      )}
    </div>
  )
}
