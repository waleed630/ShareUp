import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import itemsApi from '../../api/items.api'
import rentalsApi from '../../api/rentals.api'
import toast from 'react-hot-toast'
import Empty from '../../components/ui/Empty'
import RentalDatesModal from '../../components/common/RentalDatesModal'

const CATEGORIES = ['All', 'Electronics', 'Furniture', 'Kitchen Appliances', 'Gaming', 'Sports', 'Tools', 'Events', 'Outdoor', 'Vehicles', 'Books', 'Other']

const formatDate = iso => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BrowseItems() {
  const [items, setItems]             = useState([])
  const [reservations, setReservations] = useState({})
  const [loading, setLoading]         = useState(true)
  const [category, setCategory]       = useState('All')
  const [search, setSearch]           = useState('')
  const [requesting, setRequesting]   = useState(null)
  const [dateModal, setDateModal]     = useState(null)
  const navigate = useNavigate()

  //  Extracted to reusable function so we can call it after a request too
  const loadItems = useCallback(async () => {
    try {
      const [res, held] = await Promise.all([
        itemsApi.getAll(),
        rentalsApi.reservations().catch(() => null),
      ])
      const all = Array.isArray(res.data) ? res.data : []
      //  Only show AVAILABLE items — filter out RENTED ones
      setItems(all.filter(i => !i.status || i.status === 'AVAILABLE'))

      // Items with a pending request: "Requested" for me, "Reserved" for everyone else
      const map = {}
      if (Array.isArray(held?.data)) held.data.forEach(r => { map[r.itemId] = r })
      setReservations(map)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  // Filter by search + category
  const filtered = items.filter(i => {
    const matchSearch = !search || i.name?.toLowerCase().includes(search.toLowerCase())
    const matchCat    = category === 'All' || i.category?.toLowerCase() === category.toLowerCase()
    return matchSearch && matchCat
  })

  const submitRequest = async ({ startDate, endDate }) => {
    const item = dateModal
    const id   = item.id || item._id
    setRequesting(id)
    setDateModal(null)

    try {
      await rentalsApi.request({
        itemId:    id,
        ownerId:   item.ownerId,
        startDate,
        endDate,
      })
      toast.success('Rental request sent!')
      // ✅ Re-fetch items so RENTED items disappear immediately
      await loadItems()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Request failed. Please try again.')
      // Someone else may have reserved it in the meantime
      await loadItems()
    } finally {
      setRequesting(null)
    }
  }

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ height: 280, borderRadius: 16, background: '#f0ede8', animation: 'pulse 1.5s infinite' }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )

  if (!loading && items.length === 0) {
    return <Empty text="No items available right now." />
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        .browse-root { font-family: 'DM Sans', sans-serif; }
        .browse-title { font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 800; color: #111; letter-spacing: -0.3px; margin-bottom: 20px; }

        .browse-search {
          display: flex; align-items: center; gap: 10px;
          background: white; border: 1.5px solid #e5e0d8;
          border-radius: 10px; padding: 4px 4px 4px 14px;
          margin-bottom: 14px; transition: border-color 0.2s;
          box-shadow: 0 1px 6px rgba(0,0,0,0.04);
        }
        .browse-search:focus-within { border-color: #e85d26; }
        .browse-search input { flex: 1; border: none; outline: none; font-size: 0.875rem; background: transparent; font-family: 'DM Sans', sans-serif; color: #111; }
        .browse-search input::placeholder { color: #b0a99f; }

        .cat-pills { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 24px; }
        .cat-pill { padding: 5px 14px; border-radius: 20px; font-size: 0.78rem; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; border: 1.5px solid #e5e0d8; background: white; color: #6b7280; transition: all 0.18s; }
        .cat-pill:hover { border-color: #e85d26; color: #e85d26; }
        .cat-pill.active { background: #e85d26; border-color: #e85d26; color: white; font-weight: 600; }

        .items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; }

        .item-card { background: white; border-radius: 16px; border: 1px solid #f0ede8; overflow: hidden; transition: all 0.25s; display: flex; flex-direction: column; }
        .item-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.08); }
        .item-card-img-wrap { position: relative; overflow: hidden; }
        .item-card-img-wrap img { width: 100%; height: 180px; object-fit: cover; transition: transform 0.3s; display: block; }
        .item-card:hover .item-card-img-wrap img { transform: scale(1.04); }
        .item-card-price { position: absolute; top: 10px; right: 10px; background: rgba(15,17,23,0.82); color: white; font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
        .item-card-cat { position: absolute; top: 10px; left: 10px; background: rgba(232,93,38,0.9); color: white; font-size: 0.65rem; font-weight: 700; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.06em; }

        .item-card-body { padding: 14px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .item-name { font-family: 'Syne', sans-serif; font-size: 0.95rem; font-weight: 700; color: #111; }
        .item-desc { font-size: 0.8rem; color: #9ca3af; line-height: 1.5; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .item-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
        .item-price { font-family: 'Syne', sans-serif; font-size: 1rem; font-weight: 700; color: #111; }
        .item-price span { font-size: 0.7rem; font-weight: 400; color: #9ca3af; font-family: 'DM Sans', sans-serif; }
        .item-btns { display: flex; gap: 6px; }
        .btn-view { padding: 6px 12px; border-radius: 7px; font-size: 0.78rem; font-weight: 500; border: 1.5px solid #e5e0d8; background: white; color: #374151; cursor: pointer; transition: all 0.18s; font-family: 'DM Sans', sans-serif; }
        .btn-view:hover { border-color: #111; color: #111; }
        .btn-request { padding: 6px 14px; border-radius: 7px; font-size: 0.78rem; font-weight: 600; border: none; background: #111; color: white; cursor: pointer; transition: all 0.18s; font-family: 'DM Sans', sans-serif; }
        .btn-request:hover:not(:disabled) { background: #e85d26; }
        .btn-request:disabled { opacity: 0.5; cursor: not-allowed; }
        .item-held { margin-top: 8px; font-size: 0.76rem; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 10px; }
        .item-held strong { color: #78350f; }
        .item-held.mine { color: #1e40af; background: #eff6ff; border-color: #bfdbfe; }

        .results-count { font-size: 0.8rem; color: #9ca3af; margin-bottom: 16px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      <div className="browse-root">
        <div className="browse-title">Browse Items</div>

        {/* Search */}
        <div className="browse-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b0a99f" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Category pills */}
        <div className="cat-pills">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`cat-pill ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        {(search || category !== 'All') && (
          <div className="results-count">
            {filtered.length} item{filtered.length !== 1 ? 's' : ''} found
            {category !== 'All' ? ` in "${category}"` : ''}
            {search ? ` for "${search}"` : ''}
          </div>
        )}

        {/* Grid */}
        {filtered.length === 0 ? (
          <Empty text="No items found. Try a different search or category." />
        ) : (
          <div className="items-grid">
            {filtered.map(item => {
              const id   = item.id || item._id
              const held = reservations[id]
              return (
                <div key={id} className="item-card">
                  <div className="item-card-img-wrap">
                    <img
                      src={item.imageUrl || '/placeholder.png'}
                      alt={item.name}
                      onError={e => (e.currentTarget.src = '/placeholder.png')}
                    />
                    <span className="item-card-price">PKR {item.price}/day</span>
                    {item.category && <span className="item-card-cat">{item.category}</span>}
                  </div>
                  <div className="item-card-body">
                    <div className="item-name">{item.name}</div>
                    <div className="item-desc">{item.description}</div>
                    <div className="item-footer">
                      <div className="item-price">
                        PKR {item.price} <span>/ day</span>
                      </div>
                      <div className="item-btns">
                        <button className="btn-view" onClick={() => navigate(`/borrower/items/${id}`)}>
                          View
                        </button>
                        <button
                          className="btn-request"
                          disabled={requesting === id || !!held}
                          onClick={() => setDateModal(item)}
                        >
                          {requesting === id ? 'Sending...' : held?.mine ? 'Requested' : held ? 'Reserved' : 'Request'}
                        </button>
                      </div>
                    </div>
                    {held && (
                      <div className={`item-held ${held.mine ? 'mine' : ''}`}>
                        {held.mine
                          ? <>⏳ Waiting for owner approval</>
                          : <>🔒 Reserved · Expected until <strong>{formatDate(held.endDate)}</strong></>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {dateModal && (
        <RentalDatesModal item={dateModal} onCancel={() => setDateModal(null)} onConfirm={submitRequest} />
      )}
    </>
  )
}
