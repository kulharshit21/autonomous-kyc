import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DocumentPreview from '../components/DocumentPreview'
import StepCanvas from '../components/StepCanvas'
import VerificationChecklistLoader from '../components/VerificationChecklistLoader'
import { enhanceImageForVerification, readFileAsBase64, resizeImageIfNeeded } from '../utils/imageUtils'
import { apiClient } from '../utils/apiClient'

const ACCEPTED_TYPES = {
  'image/jpeg': true,
  'image/jpg': true,
  'image/png': true,
  'application/pdf': true
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
const MAX_FILES = 4

export default function Step2_DocumentUpload({ updateKycData }) {
  const navigate = useNavigate()
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previewItems, setPreviewItems] = useState([])
  const [documentResult, setDocumentResult] = useState(null)
  const [processedImages, setProcessedImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const hasPDFSelection = selectedFiles.some(file => file.type === 'application/pdf')
  const missingIdPhoto = documentResult?.hasPhotoInId === false

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    if (files.length > MAX_FILES) {
      setError(`You can upload up to ${MAX_FILES} files at once.`)
      return
    }

    const invalidFile = files.find(file => !ACCEPTED_TYPES[file.type])
    if (invalidFile) {
      setError('Unsupported file type. Please upload JPG, PNG, or PDF files only.')
      return
    }

    setSelectedFiles(files)
    setDocumentResult(null)
    setProcessedImages([])
    setError('')

    const nextPreviewItems = files.map(file => ({
      name: file.name,
      type: file.type,
      sizeLabel: `${(file.size / 1024).toFixed(1)} KB`,
      previewURL: IMAGE_TYPES.includes(file.type) ? URL.createObjectURL(file) : ''
    }))

    setPreviewItems(nextPreviewItems)
  }

  const handleVerify = async () => {
    if (selectedFiles.length === 0) return

    try {
      setLoading(true)
      setError('')

      const documents = await Promise.all(
        selectedFiles.map(async (file) => {
          const raw = await readFileAsBase64(file)
          const imageBase64 = IMAGE_TYPES.includes(file.type)
            ? await resizeImageIfNeeded(await enhanceImageForVerification(raw, { minDimension: 1100 }))
            : raw

          return {
            imageBase64,
            mimeType: file.type
          }
        })
      )

      const result = await apiClient.post('/api/kyc/verify-document', { documents })
      const processedImageBase64List = result.processedImageBase64List || []

      setProcessedImages(processedImageBase64List)
      setDocumentResult(result)
    } catch (err) {
      setError(err.message || 'Document verification failed. Please try again.')
    } finally {
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
    previewItems.forEach((item) => {
      if (item.previewURL) URL.revokeObjectURL(item.previewURL)
    })

    setDocumentResult(null)
    setSelectedFiles([])
    setPreviewItems([])
    setProcessedImages([])
    setError('')
  }

  return (
    <StepCanvas currentStep={2}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="animate-card-rise rounded-[30px] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Document Verification
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Upload your government ID</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Add one or more clear document images or a PDF. We will convert, parse, and verify the fields before face matching.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Supports JPG, PNG, and PDF
            </div>
          </div>
        </div>

        <div className="animate-card-rise rounded-[30px] border border-white/70 bg-white/90 p-8 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-md">
          <h2 className="text-2xl font-bold text-slate-950 mb-1">Document Upload</h2>
          <p className="text-slate-600 text-sm mb-6">
            Upload one or more clear photos or scans of your government-issued ID. This works well for passport front pages, back pages, and additional supporting pages.
          </p>

          <div className="space-y-5">
            <div>
              <label htmlFor="documentFile" className="block text-sm font-semibold text-slate-800 mb-2">
                Select ID Document Images <span className="text-red-500">*</span>
              </label>
              <input
                id="documentFile"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={handleFileChange}
                className="w-full rounded-2xl border border-slate-200 bg-white/95 p-1 text-sm text-slate-600 shadow-sm file:mr-4 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-2.5 file:font-medium file:text-white hover:file:bg-slate-800 cursor-pointer"
              />
              <p className="mt-2 text-xs text-slate-400">Accepted formats: JPG, JPEG, PNG, PDF · Up to 4 files</p>
            </div>

            {previewItems.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {previewItems.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 shadow-sm">
                    {item.previewURL ? (
                      <img
                        src={item.previewURL}
                        alt={item.name}
                        className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-500">
                        PDF
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.sizeLabel}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading && (
              <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
                <VerificationChecklistLoader hasPDF={hasPDFSelection} fileCount={selectedFiles.length} />
              </div>
            )}

            {!loading && selectedFiles.length > 0 && !documentResult && (
              <button
                onClick={handleVerify}
                className="w-full rounded-2xl bg-slate-950 py-3.5 text-white font-semibold shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Verify Document
              </button>
            )}

            {documentResult && (
              <div className="space-y-5">
                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Extracted Information</h3>
                  <DocumentPreview
                    documentResult={documentResult}
                    imageBase64List={processedImages}
                    fileNames={selectedFiles.map(file => file.name)}
                  />
                </div>

                {documentResult.authenticityReason && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">
                    <span className="font-medium">AI Assessment: </span>
                    {documentResult.authenticityReason}
                  </div>
                )}

                {missingIdPhoto && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No portrait photo was detected in the uploaded ID. Please upload the front side or a document page that clearly shows the holder photo before continuing to face verification.
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 rounded-2xl border border-slate-300 py-3 text-slate-700 font-medium transition-colors hover:bg-slate-50"
                  >
                    Re-upload
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={missingIdPhoto}
                    className="flex-1 rounded-2xl bg-slate-950 py-3 text-white font-semibold shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    Confirm and Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </StepCanvas>
  )
}
