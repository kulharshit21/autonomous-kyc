from __future__ import annotations

import base64
import io
import math
from dataclasses import dataclass
from typing import Iterable

import cv2
import numpy as np
from PIL import Image
from skimage.feature import hog, local_binary_pattern
from skimage.metrics import structural_similarity


HAAR_FACE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
HAAR_EYE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye_tree_eyeglasses.xml')
HAAR_SMILE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_smile.xml')


@dataclass
class FaceDetection:
    x: int
    y: int
    w: int
    h: int
    score: float


def decode_base64_image(image_base64: str) -> np.ndarray:
    raw = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(raw)).convert('RGB')
    rgb = np.array(image)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def encode_image_to_base64(image_bgr: np.ndarray, quality: int = 92) -> str:
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
    ok, buffer = cv2.imencode('.jpg', image_bgr, encode_params)
    if not ok:
      raise ValueError('Unable to encode image')
    return base64.b64encode(buffer.tobytes()).decode('ascii')


def to_gray(image_bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)


def preprocess_document_image(image_bgr: np.ndarray) -> np.ndarray:
    resized = resize_preserving_aspect_ratio(image_bgr, max_dimension=1600)
    lab = cv2.cvtColor(resized, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced_l = clahe.apply(l_channel)
    merged = cv2.merge((enhanced_l, a_channel, b_channel))
    enhanced = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    return cv2.fastNlMeansDenoisingColored(enhanced, None, 3, 3, 7, 21)


def preprocess_face_image(image_bgr: np.ndarray) -> np.ndarray:
    resized = resize_preserving_aspect_ratio(image_bgr, max_dimension=640)
    return cv2.bilateralFilter(resized, 5, 40, 40)


def resize_preserving_aspect_ratio(image_bgr: np.ndarray, max_dimension: int) -> np.ndarray:
    height, width = image_bgr.shape[:2]
    scale = min(1.0, max_dimension / max(height, width))
    if scale >= 1.0:
        return image_bgr
    return cv2.resize(image_bgr, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)


def estimate_image_quality(image_bgr: np.ndarray) -> dict:
    gray = to_gray(image_bgr)
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    glare_ratio = float(np.mean(gray > 245))

    brightness_score = max(0.0, 100.0 - abs(brightness - 145.0) * 0.9)
    contrast_score = min(100.0, contrast * 2.0)
    sharpness_score = min(100.0, sharpness / 8.0)
    glare_score = max(0.0, 100.0 - (glare_ratio * 1000.0))

    quality_score = max(
        0.0,
        min(
            100.0,
            (brightness_score * 0.2) +
            (contrast_score * 0.2) +
            (sharpness_score * 0.4) +
            (glare_score * 0.2),
        ),
    )

    return {
        'brightness': round(brightness_score, 1),
        'contrast': round(contrast_score, 1),
        'sharpness': round(sharpness_score, 1),
        'glare': round(100.0 - glare_score, 1),
        'qualityScore': round(quality_score, 1),
    }


def detect_faces(image_bgr: np.ndarray) -> list[FaceDetection]:
    gray = to_gray(image_bgr)
    faces = HAAR_FACE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(48, 48))
    detections = []
    for (x, y, w, h) in faces:
        area_score = (w * h) / float(gray.shape[0] * gray.shape[1])
        detections.append(FaceDetection(int(x), int(y), int(w), int(h), area_score))
    return sorted(detections, key=lambda item: item.score, reverse=True)


def crop_face(image_bgr: np.ndarray, detection: FaceDetection, margin_ratio: float = 0.18) -> np.ndarray:
    height, width = image_bgr.shape[:2]
    margin_x = int(detection.w * margin_ratio)
    margin_y = int(detection.h * margin_ratio)
    x0 = max(0, detection.x - margin_x)
    y0 = max(0, detection.y - margin_y)
    x1 = min(width, detection.x + detection.w + margin_x)
    y1 = min(height, detection.y + detection.h + margin_y)
    return image_bgr[y0:y1, x0:x1]


def extract_primary_face(image_bgr: np.ndarray) -> dict:
    detections = detect_faces(image_bgr)
    if not detections:
        return {
            'has_face': False,
            'multiple_faces': False,
            'face_count': 0,
            'face_crop': None,
            'face_bbox': None,
            'face_area_ratio': 0.0,
            'face_quality_score': 0.0,
            'quality_flags': ['no_face']
        }

    primary = detections[0]
    face_crop = crop_face(image_bgr, primary)
    face_quality = estimate_image_quality(face_crop)
    face_area_ratio = round((primary.w * primary.h) / float(image_bgr.shape[0] * image_bgr.shape[1]), 4)

    flags: list[str] = []
    if len(detections) > 1:
        flags.append('multiple_faces')
    if face_area_ratio < 0.03:
        flags.append('tiny_face')
    if face_quality['sharpness'] < 22:
        flags.append('blur')
    if face_quality['glare'] > 20:
        flags.append('glare')

    return {
        'has_face': True,
        'multiple_faces': len(detections) > 1,
        'face_count': len(detections),
        'face_crop': face_crop,
        'face_bbox': {'x': primary.x, 'y': primary.y, 'w': primary.w, 'h': primary.h},
        'face_area_ratio': face_area_ratio,
        'face_quality_score': face_quality['qualityScore'],
        'quality_flags': flags,
    }


def normalize_face_crop(face_bgr: np.ndarray, size: int = 160) -> np.ndarray:
    gray = to_gray(preprocess_face_image(face_bgr))
    return cv2.resize(gray, (size, size), interpolation=cv2.INTER_LINEAR)


def hog_descriptor(face_gray: np.ndarray) -> np.ndarray:
    descriptor = hog(
        face_gray,
        orientations=9,
        pixels_per_cell=(16, 16),
        cells_per_block=(2, 2),
        transform_sqrt=True,
        feature_vector=True,
    )
    return descriptor.astype(np.float32)


def lbp_histogram(face_gray: np.ndarray) -> np.ndarray:
    lbp = local_binary_pattern(face_gray, P=8, R=1, method='uniform')
    hist, _ = np.histogram(lbp.ravel(), bins=np.arange(0, 11), range=(0, 10))
    hist = hist.astype(np.float32)
    hist /= max(np.linalg.norm(hist), 1e-6)
    return hist


def cosine_similarity(vector_a: np.ndarray, vector_b: np.ndarray) -> float:
    denom = float(np.linalg.norm(vector_a) * np.linalg.norm(vector_b))
    if denom <= 1e-8:
        return 0.0
    return float(np.dot(vector_a, vector_b) / denom)


def orb_match_score(face_a: np.ndarray, face_b: np.ndarray) -> float:
    orb = cv2.ORB_create(nfeatures=256)
    key_a, desc_a = orb.detectAndCompute(face_a, None)
    key_b, desc_b = orb.detectAndCompute(face_b, None)

    if desc_a is None or desc_b is None or not key_a or not key_b:
        return 0.0

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = matcher.match(desc_a, desc_b)
    if not matches:
        return 0.0

    good_matches = [match for match in matches if match.distance < 55]
    return min(100.0, (len(good_matches) / max(12, min(len(key_a), len(key_b)))) * 100.0)


def structural_similarity_score(face_a: np.ndarray, face_b: np.ndarray) -> float:
    score = structural_similarity(face_a, face_b, data_range=255)
    return max(0.0, min(100.0, score * 100.0))


def compute_face_similarity(face_a_bgr: np.ndarray, face_b_bgr: np.ndarray) -> dict:
    face_a = normalize_face_crop(face_a_bgr)
    face_b = normalize_face_crop(face_b_bgr)

    hog_score = max(0.0, min(100.0, (cosine_similarity(hog_descriptor(face_a), hog_descriptor(face_b)) + 1.0) * 50.0))
    lbp_score = max(0.0, min(100.0, (cosine_similarity(lbp_histogram(face_a), lbp_histogram(face_b)) + 1.0) * 50.0))
    orb_score = orb_match_score(face_a, face_b)
    ssim_score = structural_similarity_score(face_a, face_b)

    fused_score = (
        (hog_score * 0.35) +
        (lbp_score * 0.25) +
        (orb_score * 0.2) +
        (ssim_score * 0.2)
    )

    return {
        'hogScore': round(hog_score, 1),
        'lbpScore': round(lbp_score, 1),
        'orbScore': round(orb_score, 1),
        'ssimScore': round(ssim_score, 1),
        'fusedScore': round(max(0.0, min(100.0, fused_score)), 1),
    }


def detect_eyes(face_bgr: np.ndarray) -> int:
    gray = normalize_face_crop(face_bgr, size=180)
    eyes = HAAR_EYE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(18, 18))
    return len(eyes)


def detect_smile(face_bgr: np.ndarray) -> bool:
    gray = normalize_face_crop(face_bgr, size=180)
    smiles = HAAR_SMILE.detectMultiScale(gray, scaleFactor=1.6, minNeighbors=18, minSize=(30, 18))
    return len(smiles) > 0


def face_center(face_bbox: dict | None) -> tuple[float, float]:
    if not face_bbox:
        return 0.0, 0.0
    return (
        face_bbox['x'] + (face_bbox['w'] / 2.0),
        face_bbox['y'] + (face_bbox['h'] / 2.0),
    )


def average(values: Iterable[float]) -> float:
    values = list(values)
    return float(sum(values) / len(values)) if values else 0.0
