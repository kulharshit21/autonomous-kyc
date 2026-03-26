// LoadingSpinner.jsx — reusable animated spinner with optional message
export default function LoadingSpinner({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      {message && <p className="text-gray-600 text-sm">{message}</p>}
    </div>
  )
}
