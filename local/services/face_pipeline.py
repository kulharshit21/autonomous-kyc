from __future__ import annotations

from ..utils.image_ops import (
    average,
    decode_base64_image,
    estimate_image_quality,
    extract_primary_face,
    compute_face_similarity,
)
from .liveness_pipeline import evaluate_guided_liveness


def _clarity_label(face_info: dict) -> str:
    if not face_info['has_face']:
        return 'no_photo'
    if face_info['face_area_ratio'] < 0.03:
        return 'too_small'
    if face_info['face_quality_score'] < 40:
        return 'unclear'
    if face_info['face_quality_score'] < 60:
        return 'slightly_unclear'
    return 'clear'


def _frame_weight(entry: dict) -> float:
    step_bonus = {
        'center': 1.15,
        'left': 1.0,
        'right': 1.0,
        'up': 0.9,
        'blink': 0.55,
        'smile': 0.95,
    }.get(entry['step'], 0.9)
    quality_score = entry.get('frameQualityScore', entry.get('qualityScore', 50))
    base = max(0.35, quality_score / 100.0)
    return base * step_bonus


def verify_face_local(
    id_image_base64: str,
    selfie_base64: str,
    liveness_frames: list[str] | None = None,
    live_frame_quality_scores: list[dict] | None = None,
    primary_frame_step: str = '',
    primary_frame_quality_score: float = 0,
) -> dict:
    id_image = decode_base64_image(id_image_base64)
    selfie_image = decode_base64_image(selfie_base64)

    id_face_info = extract_primary_face(id_image)
    selfie_face_info = extract_primary_face(selfie_image)

    id_photo_clarity = _clarity_label(id_face_info)
    selfie_clarity = _clarity_label(selfie_face_info)
    liveness_result = evaluate_guided_liveness(liveness_frames or [], live_frame_quality_scores or [])

    if not id_face_info['has_face']:
        return {
            'matchScore': 0,
            'fusedMatchScore': 0,
            'perFrameSimilarityScores': [],
            'isLivePerson': False,
            'livenessConfidence': liveness_result['liveSessionLivenessScore'],
            'liveSessionLivenessScore': liveness_result['liveSessionLivenessScore'],
            'verificationPassed': False,
            'faceDecision': 'RECAPTURE',
            'faceDetectedInId': False,
            'faceDetectedInSelfie': selfie_face_info['has_face'],
            'reasoning': 'No usable portrait was detected in the uploaded ID document.',
            'faceUncertain': True,
            'idPhotoClarity': id_photo_clarity,
            'selfieClarity': selfie_clarity,
            'samePersonConfidence': 0,
            'shouldRejectAsDifferentPerson': False,
            'featureLikelihood': 0,
            'featureAgreementCount': 0,
            'featureMismatchCount': 0,
            'liveFrameQualityScores': live_frame_quality_scores or [],
        }

    if not selfie_face_info['has_face']:
        return {
            'matchScore': 0,
            'fusedMatchScore': 0,
            'perFrameSimilarityScores': [],
            'isLivePerson': False,
            'livenessConfidence': liveness_result['liveSessionLivenessScore'],
            'liveSessionLivenessScore': liveness_result['liveSessionLivenessScore'],
            'verificationPassed': False,
            'faceDecision': 'RECAPTURE',
            'faceDetectedInId': True,
            'faceDetectedInSelfie': False,
            'reasoning': 'No usable face was detected in the captured selfie.',
            'faceUncertain': True,
            'idPhotoClarity': id_photo_clarity,
            'selfieClarity': selfie_clarity,
            'samePersonConfidence': 0,
            'shouldRejectAsDifferentPerson': False,
            'featureLikelihood': 0,
            'featureAgreementCount': 0,
            'featureMismatchCount': 0,
            'liveFrameQualityScores': live_frame_quality_scores or [],
        }

    primary_similarity = compute_face_similarity(id_face_info['face_crop'], selfie_face_info['face_crop'])
    primary_quality = estimate_image_quality(selfie_face_info['face_crop'])
    per_frame_scores = [{
        'step': primary_frame_step or 'primary',
        'similarityScore': primary_similarity['fusedScore'],
        'frameQualityScore': primary_quality['qualityScore'],
        'hogScore': primary_similarity['hogScore'],
        'lbpScore': primary_similarity['lbpScore'],
        'orbScore': primary_similarity['orbScore'],
        'ssimScore': primary_similarity['ssimScore'],
    }]

    for index, frame_base64 in enumerate((liveness_frames or [])[:6]):
        try:
            frame_image = decode_base64_image(frame_base64)
            frame_face_info = extract_primary_face(frame_image)
            if not frame_face_info['has_face']:
                continue
            comparison = compute_face_similarity(id_face_info['face_crop'], frame_face_info['face_crop'])
            frame_quality = estimate_image_quality(frame_face_info['face_crop'])
            per_frame_scores.append({
                'step': ['center', 'left', 'right', 'up', 'blink', 'smile'][index] if index < 6 else f'frame_{index + 1}',
                'similarityScore': comparison['fusedScore'],
                'frameQualityScore': frame_quality['qualityScore'],
                'hogScore': comparison['hogScore'],
                'lbpScore': comparison['lbpScore'],
                'orbScore': comparison['orbScore'],
                'ssimScore': comparison['ssimScore'],
            })
        except Exception:
            continue

    weighted_total = 0.0
    weight_sum = 0.0
    for entry in per_frame_scores:
        weight = _frame_weight(entry)
        weight_sum += weight
        weighted_total += entry['similarityScore'] * weight

    fused_match_score = round(weighted_total / max(weight_sum, 1e-6))
    per_frame_values = [entry['similarityScore'] for entry in per_frame_scores]
    similarity_spread = (max(per_frame_values) - min(per_frame_values)) if len(per_frame_values) > 1 else 0
    average_quality = average(entry['frameQualityScore'] for entry in per_frame_scores)
    same_person_confidence = round((fused_match_score * 0.75) + (average_quality * 0.25))

    feature_agreement_count = 0
    if primary_similarity['hogScore'] >= 70:
        feature_agreement_count += 1
    if primary_similarity['lbpScore'] >= 70:
        feature_agreement_count += 1
    if primary_similarity['orbScore'] >= 55:
        feature_agreement_count += 1
    if primary_similarity['ssimScore'] >= 62:
        feature_agreement_count += 1

    feature_mismatch_count = 0
    if primary_similarity['hogScore'] < 55:
        feature_mismatch_count += 1
    if primary_similarity['lbpScore'] < 55:
        feature_mismatch_count += 1
    if primary_similarity['orbScore'] < 20:
        feature_mismatch_count += 1
    if primary_similarity['ssimScore'] < 48:
        feature_mismatch_count += 1
    if similarity_spread >= 22:
        feature_mismatch_count += 1

    should_reject_as_different_person = feature_mismatch_count >= 3 or (
        fused_match_score < 58 and average_quality >= 45
    )

    if liveness_result['decision'] == 'SPOOF_FAIL':
        face_decision = 'SPOOF_FAIL'
        verification_passed = False
    else:
        pass_threshold = 74
        review_threshold = 60
        if id_photo_clarity in {'too_small', 'unclear'}:
            pass_threshold += 4
            review_threshold -= 2
        if average_quality >= 72:
            pass_threshold -= 2
        if similarity_spread >= 18:
            pass_threshold += 3

        if should_reject_as_different_person:
            face_decision = 'NO_MATCH'
            verification_passed = False
        elif fused_match_score >= pass_threshold and same_person_confidence >= 68 and liveness_result['liveSessionLivenessScore'] >= 60:
            face_decision = 'MATCH'
            verification_passed = True
        elif fused_match_score >= review_threshold:
            face_decision = 'REVIEW'
            verification_passed = False
        else:
            face_decision = 'NO_MATCH'
            verification_passed = False

    reasoning = (
        f"Local face fusion scored {fused_match_score}/100 across {len(per_frame_scores)} frame comparisons. "
        f"Primary feature signals were HOG {round(primary_similarity['hogScore'])}, "
        f"LBP {round(primary_similarity['lbpScore'])}, ORB {round(primary_similarity['orbScore'])}, "
        f"and SSIM {round(primary_similarity['ssimScore'])}. "
        f"Liveness decision: {liveness_result['decision']}."
    )

    return {
        'matchScore': fused_match_score,
        'fusedMatchScore': fused_match_score,
        'perFrameSimilarityScores': per_frame_scores,
        'isLivePerson': liveness_result['decision'] != 'SPOOF_FAIL',
        'livenessConfidence': liveness_result['liveSessionLivenessScore'],
        'liveSessionLivenessScore': liveness_result['liveSessionLivenessScore'],
        'verificationPassed': verification_passed,
        'faceDecision': face_decision,
        'faceDetectedInId': True,
        'faceDetectedInSelfie': True,
        'reasoning': reasoning,
        'faceUncertain': face_decision in {'REVIEW', 'RECAPTURE'},
        'idPhotoClarity': id_photo_clarity,
        'selfieClarity': selfie_clarity,
        'samePersonConfidence': same_person_confidence,
        'shouldRejectAsDifferentPerson': should_reject_as_different_person,
        'featureLikelihood': same_person_confidence,
        'featureAgreementCount': feature_agreement_count,
        'featureMismatchCount': feature_mismatch_count,
        'livenessDetails': liveness_result,
        'liveFrameQualityScores': live_frame_quality_scores or [],
    }
