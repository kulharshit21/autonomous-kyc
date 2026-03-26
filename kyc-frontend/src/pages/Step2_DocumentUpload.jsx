import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar'
import DocumentPreview from '../components/DocumentPreview'
import VerificationChecklistLoader from '../components/VerificationChecklistLoader'
import { readFileAsBase64, resizeImageIfNeeded } from '../utils/imageUtils'
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
            ? await resizeImageIfNeeded(raw)
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
    <div className="min-h-screen bg-gray-50">
      <ProgressBar currentStep={2} />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Document Upload</h1>
          <p className="text-gray-600 text-sm mb-6">
            Upload one or more clear photos or scans of your government-issued ID. This works well for passport front pages, back pages, and additional supporting pages.
          </p>

          <div className="space-y-5">
            <div>
              <label htmlFor="documentFile" className="block text-sm font-medium text-gray-700 mb-1">
                Select ID Document Images <span className="text-red-500">*</span>
              </label>
              <input
                id="documentFile"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100 cursor-pointer border border-gray-300 rounded-lg p-1"
              />
              <p className="text-xs text-gray-400 mt-1">Accepted formats: JPG, JPEG, PNG, PDF · Up to 4 files</p>
            </div>

            {previewItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {previewItems.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    {item.previewURL ? (
                      <img
                        src={item.previewURL}
                        alt={item.name}
                        className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-xs text-gray-500">
                        PDF
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.sizeLabel}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {loading && (
              <VerificationChecklistLoader
                hasPDF={hasPDFSelection}
                fileCount={selectedFiles.length}
              />
            )}

            {!loading && selectedFiles.length > 0 && !documentResult && (
              <button
                onClick={handleVerify}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Verify Document
              </button>
            )}

            {documentResult && (
              <div className="space-y-5">
                <div className="border border-gray-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">Extracted Information</h2>
                  <DocumentPreview
                    documentResult={documentResult}
                    imageBase64List={processedImages}
                    fileNames={selectedFiles.map(file => file.name)}
                  />
                </div>

                {documentResult.authenticityReason && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600">
                    <span className="font-medium">AI Assessment: </span>
                    {documentResult.authenticityReason}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Re-upload
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    Confirm and Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
