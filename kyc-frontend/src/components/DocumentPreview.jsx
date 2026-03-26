export default function DocumentPreview({ documentResult, imageBase64List = [], fileNames = [] }) {
  const fields = [
    { label: 'Document Type', value: documentResult.documentType },
    { label: 'Full Name', value: documentResult.extractedName },
    { label: 'Date of Birth', value: documentResult.extractedDOB },
    { label: 'ID Number', value: documentResult.idNumber },
    { label: 'Address', value: documentResult.address || '-' },
    { label: 'Expiry Date', value: documentResult.expiryDate }
  ]

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full">
      <div className="flex-shrink-0 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {imageBase64List.length > 0 ? (
            imageBase64List.map((imageBase64, index) => (
              <div key={`${fileNames[index] || 'document'}-${index}`} className="w-32">
                <img
                  src={`data:image/jpeg;base64,${imageBase64}`}
                  alt={fileNames[index] || `Uploaded document ${index + 1}`}
                  className="w-32 h-24 object-cover rounded-lg border border-gray-200 shadow-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1 truncate">
                  {fileNames[index] || `Document ${index + 1}`}
                </p>
              </div>
            ))
          ) : (
            <div className="w-48 h-32 bg-gray-50 border border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 shadow-sm">
              <span className="text-xs text-gray-500 text-center px-2">
                No preview available
              </span>
            </div>
          )}
        </div>

        <div className={`text-xs font-semibold text-center px-2 py-1 rounded-full
          ${documentResult.isAuthentic ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {documentResult.isAuthentic ? 'Document Appears Genuine' : 'Document Looks Suspicious'}
        </div>

        {documentResult.tamperingDetected && (
          <div className="text-xs font-semibold text-center px-2 py-1 rounded-full bg-red-100 text-red-700">
            Tampering Detected
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3">
        {fields.map(field => (
          <div key={field.label}>
            <p className="text-xs text-gray-500 font-medium">{field.label}</p>
            <p className="text-sm text-gray-900 font-semibold truncate">{field.value || '-'}</p>
          </div>
        ))}
        <div>
          <p className="text-xs text-gray-500 font-medium">Document Read Confidence</p>
          <p className="text-sm text-gray-900 font-semibold">{documentResult.confidenceScore}%</p>
        </div>
      </div>
    </div>
  )
}
