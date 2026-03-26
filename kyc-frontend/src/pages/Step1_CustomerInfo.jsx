import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar'

export default function Step1_CustomerInfo({ kycData, updateKycData }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(kycData.customerInfo)
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const newErrors = {}
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required'
    if (!form.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required'
    if (!form.idNumber.trim()) newErrors.idNumber = 'ID number is required'
    if (!form.email.trim()) newErrors.email = 'Email is required'
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required'
    return newErrors
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    updateKycData({ customerInfo: form })
    navigate('/step/2')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProgressBar currentStep={1} />
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Customer Information</h1>
          <p className="text-gray-600 text-sm mb-6">Please provide your personal details to begin verification.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={handleChange}
                placeholder="As printed on your ID document"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.fullName ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.dateOfBirth ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>}
            </div>

            <div>
              <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700 mb-1">
                ID Number <span className="text-red-500">*</span>
              </label>
              <input
                id="idNumber"
                name="idNumber"
                type="text"
                value={form.idNumber}
                onChange={handleChange}
                placeholder="Aadhaar, PAN, Passport, or Licence number"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.idNumber ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.idNumber && <p className="text-red-500 text-xs mt-1">{errors.idNumber}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors mt-2"
            >
              Continue to Document Upload
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
