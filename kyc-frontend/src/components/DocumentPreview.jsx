export default function DocumentPreview({ documentResult, imageBase64List = [], fileNames = [] }) {
  const confidence = Number(documentResult.confidenceScore) || 0
  const confidenceLabel = confidence >= 90
    ? 'Excellent'
    : confidence >= 75
      ? 'High'
      : confidence >= 60
        ? 'Moderate'
        : 'Low'

  const fields = [
    { label: 'Document Type', value: documentResult.documentType },
    { label: 'Full Name', value: documentResult.extractedName },
    { label: 'Date of Birth', value: documentResult.extractedDOB },
    { label: 'ID Number', value: documentResult.idNumber },
    { label: 'Address', value: documentResult.address || '-' },
    { label: 'Expiry Date', value: documentResult.expiryDate }
  ]

  return (
    <div className="flex w-full flex-col gap-6 md:flex-row">
      <div className="flex flex-shrink-0 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {imageBase64List.length > 0 ? (
            imageBase64List.map((imageBase64, index) => (
              <div key={`${fileNames[index] || 'document'}-${index}`} className="w-32">
                <img
                  src={`data:image/jpeg;base64,${imageBase64}`}
                  alt={fileNames[index] || `Uploaded document ${index + 1}`}
                  className="h-24 w-32 rounded-lg border border-gray-200 object-cover shadow-sm"
                />
                <p className="mt-1 truncate text-[11px] text-gray-500">
                  {fileNames[index] || `Document ${index + 1}`}
                </p>
              </div>
            ))
          ) : (
            <div className="flex h-32 w-48 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 shadow-sm">
              <span className="px-2 text-center text-xs text-gray-500">
                No preview available
              </span>
            </div>
          )}
        </div>

        <div className={`rounded-full px-2 py-1 text-center text-xs font-semibold
          ${documentResult.isAuthentic ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {documentResult.isAuthentic ? 'Document Appears Genuine' : 'Document Looks Suspicious'}
        </div>

        {documentResult.tamperingDetected && (
          <div className="rounded-full bg-red-100 px-2 py-1 text-center text-xs font-semibold text-red-700">
            Tampering Detected
          </div>
        )}
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3">
        {fields.map(field => (
          <div key={field.label}>
            <p className="text-xs font-medium text-gray-500">{field.label}</p>
            <p className="truncate text-sm font-semibold text-gray-900">{field.value || '-'}</p>
          </div>
        ))}
        <div>
          <p className="text-xs font-medium text-gray-500">Document Analysis Confidence</p>
          <p className="text-sm font-semibold text-gray-900">
            {confidence}% <span className="font-medium text-gray-500">· {confidenceLabel}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
