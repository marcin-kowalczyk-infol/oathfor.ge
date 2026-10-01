<?php

declare(strict_types=1);
namespace App\Proof;

use App\Oath\OathFailure;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/** One parsed multipart proof submission. The image bytes are exactly what the client sent. */
final readonly class SubmissionInput
{
    public const array MODES = ['photo', 'activity_record'];

    private function __construct(public string $submissionId, public string $mode, #[\SensitiveParameter] public string $image) {}
    /** @param array<string, mixed> $fields */
    public static function parse(array $fields, mixed $image): self|OathFailure
    {
        $submissionId = $fields['submissionId'] ?? null;
        if (!is_string($submissionId) || 1 !== preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $submissionId)) { return new OathFailure('invalid_submission_id', 422, 'submissionId'); }
        $mode = $fields['mode'] ?? null;
        if (!is_string($mode) || !in_array($mode, self::MODES, true)) { return new OathFailure('invalid_mode', 422, 'mode'); }
        // Form fields are strings, and only the exact confirmation counts (T01-P04).
        if ('true' !== ($fields['declaration'] ?? null)) { return new OathFailure('declaration_required', 422, 'declaration'); }
        if (null === $image || ($image instanceof UploadedFile && \UPLOAD_ERR_NO_FILE === $image->getError())) { return new OathFailure('image_required', 422, 'image'); }
        if (!$image instanceof UploadedFile) { return new OathFailure('invalid_request'); }
        if (in_array($image->getError(), [\UPLOAD_ERR_INI_SIZE, \UPLOAD_ERR_FORM_SIZE], true)) { return new OathFailure('too_large', 422, 'image'); }
        // A partial upload or a server-side upload fault is not the player's image, so the client may retry.
        if (!$image->isValid()) { return new OathFailure('temporarily_unavailable', 503); }
        // Checked before reading, so an oversized file never enters memory.
        if ($image->getSize() > ProofImageNormalizer::MAX_BYTES) { return new OathFailure('too_large', 422, 'image'); }
        try { $bytes = $image->getContent(); }
        catch (\Symfony\Component\HttpFoundation\File\Exception\FileException) { return new OathFailure('temporarily_unavailable', 503); }
        return new self($submissionId, $mode, $bytes);
    }
}
