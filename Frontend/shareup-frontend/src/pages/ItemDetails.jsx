import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import itemsApi from '../api/items.api'
import useAuth from '../hooks/useAuth'
import toast from 'react-hot-toast'

// Public, read-only item page. Requesting happens in the borrower dashboard.
export default function ItemDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await itemsApi.getById(id)
        setItem(res.data)
      } catch {
        toast.error('Failed to load item')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  if (loading) return <p className="p-6">Loading...</p>
  if (!item) return <p className="p-6">Item not found</p>

  const imageUrl = item.imageUrl || '/placeholder.png'

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow">
      <div className="grid md:grid-cols-2 gap-6">
        <img
          src={imageUrl}
          alt={item.name}
          onError={e => (e.currentTarget.src = '/placeholder.png')}
          className="w-full h-72 object-cover rounded-lg"
        />

        <div className="space-y-3">
          <h1 className="text-3xl font-bold">{item.name}</h1>
          <p>{item.description}</p>
          <p className="font-semibold">PKR {item.price} / day</p>

          <div className="bg-gray-100 p-3 rounded">
            <p className="text-sm text-gray-500">Pickup Address</p>
            <p>{item.pickupAddress || 'Not provided'}</p>
          </div>

          {/* Owners cannot rent, so they get no button */}
          {!user && (
            <Link to="/login" className="inline-block bg-black text-white px-4 py-2 rounded">
              Sign in to rent this item
            </Link>
          )}
          {user?.role === 'BORROWER' && (
            <Link to={`/borrower/items/${item.id || item._id}`} className="inline-block bg-black text-white px-4 py-2 rounded">
              Rent this item
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
