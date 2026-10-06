import rentalAxios from './rentalAxios'

export default {
  // Borrower — rate the owner of a completed rental
  rate: (rentalId, data) => rentalAxios.post(`/api/rentals/${rentalId}/rate`, data),

  // Ratings received by the logged-in user
  getMyRatings: () => rentalAxios.get('/api/rentals/ratings/me')
}
