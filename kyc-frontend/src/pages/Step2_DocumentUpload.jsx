import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DocumentPreview from '../components/DocumentPreview'
import ScannerLightbox from '../components/ScannerLightbox'
import StepCanvas from '../components/StepCanvas'
import VerificationChecklistLoader from '../components/VerificationChecklistLoader'
import { enhanceImageForVerification, readFileAsBase64, resizeImageIfNeeded } from '../utils/imageUtils'
import { apiClient } from '../utils/apiClient'

const ACCEPTED = { 'image/jpeg':1, 'image/jpg':1, 'image/png':1, 'application/pdf':1 }
const IMG_TYPES = ['image/jpeg','image/jpg','image/png']
const MAX_FILES = 4

export default function Step2_DocumentUpload({ updateKycData }) {
  const navigate = useNavigate()
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previewItems, setPreviewItems] = useState([])
  const [documentResult, setDocumentResult] = useState(null)
  const [processedImages, setProcessedImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scannerSrc, setScannerSrc] = useState(null) // scanner lightbox image

  const hasPDF = selectedFiles.some(f => f.type === 'application/pdf')
  const missingIdPhoto = documentResult?.hasPhotoInId === false

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (files.length > MAX_FILES) { setError(`Max ${MAX_FILES} files allowed.`); return }
    if (files.find(f => !ACCEPTED[f.type])) { setError('Only JPG, PNG, and PDF files are accepted.'); return }
    setSelectedFiles(files); setDocumentResult(null); setProcessedImages([]); setError('')
    setPreviewItems(files.map(f => ({
      name: f.name, type: f.type,
      size: `${(f.size/1024).toFixed(1)} KB`,
      url: IMG_TYPES.includes(f.type) ? URL.createObjectURL(f) : ''
    })))
  }

  // Hold the API result while the scanner animation plays
  const pendingResultRef = useRef(null)
  const scannerActiveRef = useRef(false)

  const handleScannerClose = useCallback(() => {
    setScannerSrc(null)
    scannerActiveRef.current = false
    // Apply pending result if the API finished while scanner was showing
    if (pendingResultRef.current) {
      const { result, images } = pendingResultRef.current
      setProcessedImages(images)
      setDocumentResult(result)
      pendingResultRef.current = null
    }
    setLoading(false)
  }, [])

  const handleVerify = async () => {
    if (!selectedFiles.length) return
    try {
      setLoading(true); setError('')
      pendingResultRef.current = null

      // Show scanner lightbox with first image
      const firstFile = selectedFiles[0]
      if (IMG_TYPES.includes(firstFile.type)) {
        const previewBase64 = await readFileAsBase64(firstFile)
        setScannerSrc(`data:${firstFile.type};base64,${previewBase64}`)
        scannerActiveRef.current = true
      }

      // Run API in background while scanner plays
      const documents = await Promise.all(selectedFiles.map(async (file) => {
        const raw = await readFileAsBase64(file)
        const imageBase64 = IMG_TYPES.includes(file.type)
          ? await resizeImageIfNeeded(await enhanceImageForVerification(raw, { minDimension: 1100 }))
          : raw
        return { imageBase64, mimeType: file.type }
      }))
      const result = await apiClient.post('/api/kyc/verify-document', { documents })
      const images = result.processedImageBase64List || []

      // If scanner is still active, store result for when it closes
      if (scannerActiveRef.current) {
        pendingResultRef.current = { result, images }
      } else {
        setProcessedImages(images)
        setDocumentResult(result)
        setLoading(false)
      }
    } catch (err) {
      setError(err.message || 'Document verification failed.')
      setScannerSrc(null)
      scannerActiveRef.current = false
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    updateKycData({
      documentResult: {
        ...documentResult,
        imageBase64: documentResult.processedImageBase64 || processedImages[0] || '',
        processedImageBase64: documentResult.processedImageBase64 || processedImages[0] || '',
        processedImageBase64List: documentResult.processedImageBase64List || processedImages
      }
    })
    navigate('/step/3')
  }

  const handleReset = () => {
    previewItems.forEach(i => { if (i.url) URL.revokeObjectURL(i.url) })
    setDocumentResult(null); setSelectedFiles([]); setPreviewItems([]); setProcessedImages([]); setError('')
  }

  return (
    <StepCanvas currentStep={2}>
      {/* Scanner Lightbox */}
      {scannerSrc && <ScannerLightbox imageSrc={scannerSrc} label="Scanning document..." onClose={handleScannerClose} />}

      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="animate-card-rise teal-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-100/70">Document Verification</p>
              <h1 className="mt-1 text-2xl font-bold">Upload your government ID</h1>
              <p className="mt-1 text-sm text-teal-100/80">Clear document images or a PDF. We'll scan, parse, and verify all fields.</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-sm text-teal-50/90">
              📎 JPG · PNG · PDF
            </div>
          </div>
        </div>

        {/* Upload area */}
        <div className="animate-card-rise stagger-1 warm-card-strong p-8">
          <h2 className="text-lg font-bold text-[var(--charcoal)] mb-1">Upload Documents</h2>
          <p className="text-sm text-[var(--stone)] mb-5">Select clear photos or scans of your government-issued ID.</p>

          <div className="space-y-5">
            <div>
              <label htmlFor="documentFile" className="block text-xs font-semibold uppercase tracking-wider text-[var(--stone)] mb-2">
                Select Files <span className="text-[var(--teal)]">*</span>
              </label>
              <input
                id="documentFile" type="file" multiple
                accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange}
                className="w-full rounded-xl border border-[var(--warm-border)] bg-[var(--cream)] p-1 text-sm text-[var(--stone)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--teal)] file:px-4 file:py-2.5 file:font-medium file:text-white hover:file:bg-[var(--teal-dark)] cursor-pointer transition-all"
              />
              <p className="mt-1.5 text-xs text-[var(--stone-light)]">Up to {MAX_FILES} files</p>
            </div>

            {previewItems.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {previewItems.map((item, i) => (
                  <div key={`${item.name}-${i}`} className="flex items-center gap-3 warm-card px-4 py-3">
                    {item.url ? (
                      <img src={item.url} alt={item.name} className="h-14 w-14 rounded-lg border border-[var(--warm-border)] object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--warm-border)] bg-[var(--cream-mid)] text-xs font-bold text-[var(--stone)]">PDF</div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--charcoal)]">{item.name}</p>
                      <p className="text-xs text-[var(--stone-light)]">{item.size}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">⚠ {error}</div>}

            {loading && !scannerSrc && (
              <div className="warm-card p-5">
                <VerificationChecklistLoader hasPDF={hasPDF} fileCount={selectedFiles.length} />
              </div>
            )}

            {!loading && selectedFiles.length > 0 && !documentResult && (
              <button onClick={handleVerify} className="btn-primary w-full">
                🔍 Scan & Verify Document
              </button>
            )}

            {documentResult && (
              <div className="space-y-5 animate-card-rise">
                <div className="warm-card p-5">
                  <h3 className="mb-3 text-sm font-bold text-[var(--teal)]">Extracted Information</h3>
                  <DocumentPreview documentResult={documentResult} imageBase64List={processedImages} fileNames={selectedFiles.map(f => f.name)} />
                </div>

                {documentResult.authenticityReason && (
                  <div className="warm-card px-4 py-3 text-sm text-[var(--charcoal-light)]">
                    <span className="font-semibold text-[var(--teal)]">AI Assessment: </span>
                    {documentResult.authenticityReason}
                  </div>
                )}

                {missingIdPhoto && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    ⚠ No portrait photo detected. Upload the front side showing the holder's photo.
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleReset} className="btn-secondary flex-1">Re-upload</button>
                  <button onClick={handleConfirm} disabled={missingIdPhoto} className="btn-primary flex-1">Confirm & Continue →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </StepCanvas>
  )
}
