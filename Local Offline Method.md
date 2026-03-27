# Local Offline Method

This document describes a fully local KYC pipeline that can run on the same laptop without sending document images or selfies to any cloud API.

The current app already uses a cloud-assisted path for rapid hackathon delivery. This local method is added as a separate stack under [`local/`](d:/per/autonomous-kyc/local) so the existing API-based flow stays untouched.

## Why a separate local path

- We keep the current demo stable.
- We can build and test offline processing independently.
- We can switch to local inference later without rewriting the frontend workflow.

## Local stack

The local stack is designed around tools that can run on-device:

- `OpenCV`
  - document cleanup
  - blur / glare / brightness estimation
  - face detection
  - eye and smile cascade checks
- `Torch`
  - available on this laptop already
  - used as the base for local model integrations if needed later
- `EasyOCR` or `Tesseract`
  - local OCR adapter layer
  - no cloud call required
  - EasyOCR can use the local GPU when its model files are cached
- `FastAPI`
  - lightweight local server
  - same type of request/response flow as the current backend

## Document flow

1. Accept the uploaded ID image locally.
2. Preprocess with OpenCV:
   - resize
   - grayscale
   - CLAHE contrast enhancement
   - denoise
3. Estimate quality:
   - sharpness
   - brightness
   - contrast
   - glare ratio
4. Detect face region on the ID with OpenCV Haar cascades.
5. For PDFs:
   - render the first page locally with PyMuPDF
   - extract embedded PDF text locally when present
   - run OCR on the rendered page when needed
6. Run local OCR through the adapter:
   - `EasyOCR` if local model files are present
   - `Tesseract` if installed on the machine
   - otherwise return a setup warning instead of silently failing
7. Parse the extracted text with regex and heuristics for:
   - Aadhaar
   - PAN
   - Passport
   - Driving Licence
8. Produce:
   - document type
   - name
   - DOB
   - ID number
   - expiry
   - `hasPhotoInId`
   - `idPhotoClarity`
   - `confidenceScore`
   - quality flags

## Face and liveness flow

1. Use the guided live capture frames already produced by the frontend.
2. Detect the face in:
   - the ID portrait
   - the selected selfie frame
   - the extra liveness frames
3. Normalize the face crop locally.
4. Build multiple local similarity signals:
   - HOG similarity
   - LBP histogram similarity
   - ORB match quality
   - structural similarity on normalized crops
5. Fuse those signals into a single local face score.
6. Evaluate liveness with local heuristics:
   - face present in multiple frames
   - left/right/up movement consistency
   - blink proxy using eye detections
   - smile proxy using smile cascade
   - frame-to-frame motion stability
7. Produce:
   - `per_frame_similarity_scores`
   - `fused_match_score`
   - `live_session_liveness_score`
   - decision:
     - `MATCH`
     - `REVIEW`
     - `NO_MATCH`
     - `RECAPTURE`
     - `SPOOF_FAIL`

## Risk decision flow

The local stack keeps the same high-level logic as the current app:

- document authenticity / quality
- face match quality
- liveness strength
- data consistency
- expiry

Then it produces:

- `riskScore`
- `riskCategory`
- `decision`
- `breakdown`
- `explanation`

## What is implemented in this repo

Inside [`local/`](d:/per/autonomous-kyc/local) you will find:

- a separate FastAPI app
- OpenCV-based document and face preprocessing
- local OCR adapter layer
- local face matching pipeline
- local liveness heuristics
- local risk engine
- smoke tests

## Important note about OCR models

This machine now has `easyocr` available with the English recognition model cached locally, so image OCR and rendered PDF OCR can run fully on-device. If the project is moved to a new machine, the offline path still needs either:

- EasyOCR model files already present on disk
- or Tesseract installed locally

Once those assets exist locally, no cloud processing is required.

## Why this is a strong hackathon answer

If the panel asks why cloud APIs were used, you can say:

- the current app proves the workflow quickly
- the repo now also contains a separate local architecture
- the local design avoids cloud transfer of sensitive KYC images
- the same flow can be run entirely on-device with local OCR, face matching, and liveness

## Run strategy

Keep the current app as-is.

For the local path:

1. Start the separate local server from [`local/app.py`](d:/per/autonomous-kyc/local/app.py)
2. Point a future frontend switch or test client to the local endpoints
3. Keep cloud and local methods side by side until the offline path is fully validated
