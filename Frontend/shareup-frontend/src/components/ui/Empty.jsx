export default function Empty({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
      <div className="text-5xl mb-4" aria-hidden="true">📦</div>
      <p className="text-lg">{text}</p>
    </div>
  )
}
