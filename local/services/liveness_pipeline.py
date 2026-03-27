from __future__ import annotations

from ..utils.image_ops import (
    average,
    decode_base64_image,
    detect_eyes,
    detect_smile,
    estimate_image_quality,
    extract_primary_face,
    face_center,
)


EXPECTED_STEPS = ['center', 'left', 'right', 'up', 'blink', 'smile']


def evaluate_guided_liveness(frames_base64: list[str], live_frame_quality_scores: list[dict] | None = None) -> dict:
    if not frames_base64:
        return {
            'perStepCompliance': {},
            'liveSessionLivenessScore': 0,
            'decision': 'RECAPTURE',
            'reasoning': 'No live frames were supplied for local liveness verification.'
        }

    analyses = []
    for index, frame in enumerate(frames_base64):
        image = decode_base64_image(frame)
        quality = estimate_image_quality(image)
        face_info = extract_primary_face(image)
        face_crop = face_info['face_crop']
        eye_count = detect_eyes(face_crop) if face_crop is not None else 0
        smile_detected = detect_smile(face_crop) if face_crop is not None else False
        analyses.append({
            'step': EXPECTED_STEPS[index] if index < len(EXPECTED_STEPS) else f'frame_{index + 1}',
            'quality': quality,
            'hasFace': face_info['has_face'],
            'faceBBox': face_info['face_bbox'],
            'eyeCount': eye_count,
            'smileDetected': smile_detected,
        })

    center = analyses[0]
    center_x, center_y = face_center(center['faceBBox'])
    per_step = {}

    for analysis in analyses:
        step = analysis['step']
        compliance = analysis['hasFace'] and analysis['quality']['qualityScore'] >= 35
        note = 'face_detected'

        x, y = face_center(analysis['faceBBox'])
        if step == 'left':
            compliance = compliance and abs(x - center_x) > 8
            note = 'head_moved_left_or_pose_changed'
        elif step == 'right':
            compliance = compliance and abs(x - center_x) > 8
            note = 'head_moved_right_or_pose_changed'
        elif step == 'up':
            compliance = compliance and abs(y - center_y) > 6
            note = 'head_moved_up_or_pose_changed'
        elif step == 'blink':
            compliance = compliance and analysis['eyeCount'] < max(1, center['eyeCount'])
            note = 'eye_opening_reduced_for_blink'
        elif step == 'smile':
            compliance = compliance and analysis['smileDetected']
            note = 'smile_detected'

        per_step[step] = {
            'compliant': bool(compliance),
            'qualityScore': analysis['quality']['qualityScore'],
            'note': note
        }

    compliant_count = sum(1 for item in per_step.values() if item['compliant'])
    average_quality = average(item['quality']['qualityScore'] for item in analyses)
    face_presence_ratio = average(100 if item['hasFace'] else 0 for item in analyses)

    liveness_score = round(
        (compliant_count / max(1, len(per_step))) * 55 +
        (average_quality * 0.25) +
        (face_presence_ratio * 0.2)
    )

    if liveness_score < 40:
        decision = 'SPOOF_FAIL'
    elif liveness_score < 60:
        decision = 'REVIEW'
    else:
        decision = 'PASS'

    return {
        'perStepCompliance': per_step,
        'liveSessionLivenessScore': max(0, min(100, liveness_score)),
        'decision': decision,
        'reasoning': f'Local liveness verified {compliant_count} of {len(per_step)} guided checks with average frame quality {round(average_quality)}.'
    }
