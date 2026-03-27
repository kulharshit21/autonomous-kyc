export default function DocumentPreview({ documentResult, imageBase64List = [], fileNames = [] }) {
  const confidence = Number(documentResult.confidenceScore) || 0
  const label = confidence >= 90 ? 'Excellent' : confidence >= 75 ? 'High' : confidence >= 60 ? 'Moderate' : 'Low'

  const fields = [
    { l: 'Document Type', v: documentResult.documentType },
    { l: 'Full Name', v: documentResult.extractedName },
    { l: 'Date of Birth', v: documentResult.extractedDOB },
    { l: 'ID Number', v: documentResult.idNumber },
    { l: 'Address', v: documentResult.address || '-' },
    { l: 'Expiry Date', v: documentResult.expiryDate },
    { l: 'ID Photo Detected', v: documentResult.hasPhotoInId === false ? 'No' : 'Yes' }
  ]

  return (
    <div className="flex w-full flex-col gap-6 md:flex-row">
      <div className="flex flex-shrink-0 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {imageBase64List.length > 0 ? imageBase64List.map((img, i) => (
            <div key={`${fileNames[i] || 'doc'}-${i}`} className="w-32">
              <img src={`data:image/jpeg;base64,${img}`} alt={fileNames[i] || `Document ${i+1}`} className="h-24 w-32 rounded-xl border border-[var(--warm-border)] object-cover shadow-sm" />
              <p className="mt-1 truncate text-[11px] text-[var(--stone-light)]">{fileNames[i] || `Document ${i+1}`}</p>
            </div>
          )) : (
            <div className="flex h-32 w-48 items-center justify-center rounded-xl border border-[var(--warm-border)] bg-[var(--cream-mid)]">
              <span className="text-xs text-[var(--stone)]">No preview</span>
            </div>
          )}
        </div>
        <div className={`rounded-full px-3 py-1.5 text-center text-xs font-semibold border ${documentResult.isAuthentic ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {documentResult.isAuthentic ? '✅ Appears Genuine' : '⚠ Suspicious'}
        </div>
        {documentResult.tamperingDetected && (
          <div className="rounded-full bg-red-50 border border-red-200 px-3 py-1.5 text-center text-xs font-semibold text-red-700">🚨 Tampering Detected</div>
        )}
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.l}>
            <p className="text-xs font-medium text-[var(--stone)]">{f.l}</p>
            <p className="truncate text-sm font-semibold text-[var(--charcoal)]">{f.v || '-'}</p>
          </div>
        ))}
        <div>
          <p className="text-xs font-medium text-[var(--stone)]">Analysis Confidence</p>
          <p className="text-sm font-semibold text-[var(--charcoal)]">{confidence}% <span className="text-[var(--teal)] font-medium">· {label}</span></p>
        </div>
      </div>
    </div>
  )
}
