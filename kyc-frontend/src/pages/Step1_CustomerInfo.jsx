import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar'

export default function Step1_CustomerInfo({ kycData, updateKycData }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(kycData.customerInfo)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleBlur = (e) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
    const err = validateField(name, form[name])
    if (err) setErrors(prev => ({ ...prev, [name]: err }))
  }

  const validateField = (name, value) => {
    switch (name) {
      case 'fullName': {
        const v = (value || '').trim()
        if (!v) return 'Full name is required'
        if (v.length < 2) return 'Name must be at least 2 characters'
        if (/^\d+$/.test(v)) return 'Name cannot be purely numeric'
        return ''
      }
      case 'dateOfBirth':
        return value ? '' : 'Date of birth is required'
      case 'idNumber': {
        const v = (value || '').trim()
        if (!v) return 'ID number is required'
        if (v.length < 4) return 'ID number must be at least 4 characters'
        return ''
      }
      case 'email': {
        const v = (value || '').trim()
        if (!v) return 'Email is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address'
        return ''
      }
      case 'phone': {
        const v = (value || '').trim()
        if (!v) return 'Phone number is required'
        const d = v.replace(/[^0-9]/g, '')
        if (d.length < 7) return 'Enter at least 7 digits'
        if (d.length > 15) return 'Phone number too long'
        return ''
      }
      default: return ''
    }
  }

  const validate = () => {
    const out = {}
    ;['fullName', 'dateOfBirth', 'idNumber', 'email', 'phone'].forEach(n => {
      const e = validateField(n, form[n])
      if (e) out[n] = e
    })
    return out
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      setTouched({ fullName:true, dateOfBirth:true, idNumber:true, email:true, phone:true })
      return
    }
    updateKycData({ customerInfo: form })
    navigate('/step/2')
  }

  const inputCls = (f) => {
    if (errors[f]) return 'kyc-input input-error'
    if (touched[f] && form[f]) return 'kyc-input input-valid'
    return 'kyc-input'
  }

  return (
    <div className="kyc-page-bg">
      <ProgressBar currentStep={1} />
      <div className="relative mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start animate-step-enter">

          {/* Left — Info panel */}
          <section className="teal-card p-8 animate-card-rise">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-100">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse" />
              Step 1
            </div>

            <h1 className="text-3xl font-bold leading-snug">
              Enter the identity details to begin verification.
            </h1>

            <p className="mt-4 text-sm leading-7 text-teal-100/80">
              We compare your inputs against the document, ID number, and face match to produce a single compliance decision.
            </p>

            <div className="mt-8 rounded-2xl bg-white/10 p-4 border border-white/15">
              <p className="text-xs font-bold uppercase tracking-wide text-teal-100/70">How it works</p>
              <p className="mt-2 text-sm text-teal-50/90 leading-6">
                All data is encrypted in transit. Rate limiting and input sanitization protect every request automatically.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { n: '01', t: 'Enter identity details' },
                { n: '02', t: 'Upload & verify ID' },
                { n: '03', t: 'Face match & results' }
              ].map((item, i) => (
                <div key={item.n} className={`rounded-2xl bg-white/10 border border-white/10 p-4 transition-all hover:bg-white/15 animate-card-rise stagger-${i+1}`}>
                  <p className="text-2xl font-bold text-white/25">{item.n}</p>
                  <p className="mt-1 text-sm text-teal-50/80">{item.t}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Right — Form */}
          <section className="warm-card-strong p-8 animate-card-rise stagger-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--teal)]">Customer Information</p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--charcoal)]">Primary identity details</h2>
            <p className="mt-2 text-sm text-[var(--stone)]">
              Enter the same full name, date of birth, and ID number that appear on the uploaded document.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="fullName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--stone)]">
                    Full Name <span className="text-[var(--teal)]">*</span>
                  </label>
                  <input id="fullName" name="fullName" type="text" value={form.fullName} onChange={handleChange} onBlur={handleBlur} placeholder="As printed on your ID" className={inputCls('fullName')} />
                  {errors.fullName && <p className="mt-1 text-xs text-[var(--danger)] animate-fade-in">⚠ {errors.fullName}</p>}
                </div>

                <div>
                  <label htmlFor="dateOfBirth" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--stone)]">
                    Date of Birth <span className="text-[var(--teal)]">*</span>
                  </label>
                  <input id="dateOfBirth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} onBlur={handleBlur} className={inputCls('dateOfBirth')} />
                  {errors.dateOfBirth && <p className="mt-1 text-xs text-[var(--danger)] animate-fade-in">⚠ {errors.dateOfBirth}</p>}
                </div>

                <div>
                  <label htmlFor="idNumber" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--stone)]">
                    ID Number <span className="text-[var(--teal)]">*</span>
                  </label>
                  <input id="idNumber" name="idNumber" type="text" value={form.idNumber} onChange={handleChange} onBlur={handleBlur} placeholder="Aadhaar, PAN, Passport, etc." className={inputCls('idNumber')} />
                  {errors.idNumber && <p className="mt-1 text-xs text-[var(--danger)] animate-fade-in">⚠ {errors.idNumber}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--stone)]">
                    Email <span className="text-[var(--teal)]">*</span>
                  </label>
                  <input id="email" name="email" type="email" value={form.email} onChange={handleChange} onBlur={handleBlur} placeholder="you@example.com" className={inputCls('email')} />
                  {errors.email && <p className="mt-1 text-xs text-[var(--danger)] animate-fade-in">⚠ {errors.email}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--stone)]">
                    Phone <span className="text-[var(--teal)]">*</span>
                  </label>
                  <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} onBlur={handleBlur} placeholder="+91 98765 43210" className={inputCls('phone')} />
                  {errors.phone && <p className="mt-1 text-xs text-[var(--danger)] animate-fade-in">⚠ {errors.phone}</p>}
                </div>
              </div>

              <div className="rounded-xl bg-[var(--cream-mid)] border border-[var(--warm-border)] px-4 py-3 text-sm text-[var(--stone)]">
                🔒 These entries are compared against document fields in the next step.
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs font-medium text-[var(--stone-light)]">Required before document upload</p>
                <button type="submit" className="btn-primary">
                  Continue →
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
