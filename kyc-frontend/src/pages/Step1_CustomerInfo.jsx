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

  const inputClassName = (field) => `w-full rounded-2xl border bg-white/95 px-4 py-3.5 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-200 ${
    errors[field] ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200'
  }`

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_54%,#e8eef6_100%)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-28 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.18)_0%,rgba(148,163,184,0.06)_38%,transparent_72%)] blur-3xl" />
        <div className="absolute right-[-8%] top-44 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.10)_0%,rgba(59,130,246,0.03)_40%,transparent_74%)] blur-3xl" />
        <div className="absolute bottom-[-10%] left-1/2 h-[420px] w-[860px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.48)_44%,transparent_80%)] blur-2xl" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)',
            backgroundSize: '56px 56px'
          }}
        />
      </div>

      <ProgressBar currentStep={1} />

      <div className="relative mx-auto max-w-6xl px-4 py-10">
        <div className="pointer-events-none absolute inset-x-4 top-8 hidden h-[760px] rounded-[40px] border border-white/50 bg-white/28 shadow-[0_30px_80px_rgba(148,163,184,0.14)] backdrop-blur-[2px] lg:block" />

        <div className="relative grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <section className="rounded-[28px] border border-slate-200/70 bg-slate-950 p-8 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="mb-8 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
              KYC Intake
            </div>

            <h1 className="max-w-md text-3xl font-semibold leading-tight">
              Enter the identity details you want the system to verify.
            </h1>

            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">
              This baseline is used to compare document extraction, ID-number matching, and final risk decisions. Keep the details aligned with the government ID.
            </p>

            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Why this matters
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Accurate inputs reduce false approvals and make mismatch flags easier to explain during compliance review.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-semibold">01</p>
                  <p className="mt-2 text-sm text-slate-300">Capture customer details</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-semibold">02</p>
                  <p className="mt-2 text-sm text-slate-300">Verify document fields</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-semibold">03</p>
                  <p className="mt-2 text-sm text-slate-300">Review face and risk output</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-md">
            <div className="mb-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Customer Information
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-950">
                  Primary identity details
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Enter the same full name, date of birth, and ID number that appear on the uploaded document.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-slate-800">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={form.fullName}
                    onChange={handleChange}
                    placeholder="As printed on your ID document"
                    className={inputClassName('fullName')}
                  />
                  {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
                </div>

                <div>
                  <label htmlFor="dateOfBirth" className="mb-2 block text-sm font-semibold text-slate-800">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={handleChange}
                    className={inputClassName('dateOfBirth')}
                  />
                  {errors.dateOfBirth && <p className="mt-1 text-xs text-red-500">{errors.dateOfBirth}</p>}
                </div>

                <div>
                  <label htmlFor="idNumber" className="mb-2 block text-sm font-semibold text-slate-800">
                    ID Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="idNumber"
                    name="idNumber"
                    type="text"
                    value={form.idNumber}
                    onChange={handleChange}
                    placeholder="Aadhaar, PAN, Passport, or Licence number"
                    className={inputClassName('idNumber')}
                  />
                  {errors.idNumber && <p className="mt-1 text-xs text-red-500">{errors.idNumber}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-800">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className={inputClassName('email')}
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-slate-800">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    className={inputClassName('phone')}
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">
                These entries will be compared against extracted document fields in the next step.
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  Required before document upload
                </p>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Continue to Document Upload
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
