# ADR 0008: Proof capture, upload and private storage

Status: accepted, 2026-10-01. Capture sources, limits and crop are owner decisions. Storage port and upload protocol are local engineering decisions confirmed by the owner. Nothing below is implemented yet.

## Context

MVP-07 needs the player to send one image as proof. The [first-loop rules](../product/first-loop.md#shared-evidence-rules) left the capture mechanism and upload limits open. Receipt `R` is recorded only after the complete upload sits in controlled storage and passes synchronous integrity checks ([committed times](../product/first-loop.md#committed-times)). [ADR 0001](0001-project-foundation.md) accepts S3-compatible proof storage for the product. The [retention schedule](../product/first-loop.md#retention-schedule) forbids raw-proof backups in the initial design.

Facts checked on 2026-10-01:
- Expo SDK 57 `expo-image-picker` offers both camera capture and library selection. It returns EXIF only when asked. With `allowsEditing` on iOS the crop is always square. **Source: [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/).**
- OWASP advises an allowlist of types, signature checks, size limits, generated names and image rewriting to remove injected content. **Source: [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).**
- MinIO, the usual local S3 stand-in, is no longer maintained and its repository was archived on 2026-04-25. **Source: [minio/minio](https://github.com/minio/minio).**
- An Apple Fitness record is a screenshot saved to Photos, so a camera-only flow cannot produce it.

## Decision

Owner decisions, 2026-10-01:
- Capture: camera and photo library for both the photo and the activity-record route. The backlog wording becomes photo capture or library selection.
- Limits: the client sends JPEG at quality 0.85 with the long edge at most 2880 px and never requests EXIF. The API accepts only JPEG by signature, at most 10 MB, at most 2880 px on the long edge and at most 9 megapixels. Dimensions are read from the header before decoding. The API re-encodes the image with GD, which drops all metadata.
- Crop: no in-app crop. The proof screen tells the player they can crop or cover private parts in Photos before choosing the image.

Local engineering decisions, confirmed by the owner on 2026-10-01:
- Storage: the API depends on a `ProofStorage` port. The first adapter keeps objects on a private filesystem volume outside `public/`, with random 128-bit names that never come from client input. Nothing serves these files directly. Only an authenticated owner endpoint streams them.
- Upload: one authenticated multipart request through the API carries the client `submissionId`, the route, the declaration and the image. The API stages and normalizes the image before taking locks, then samples `R` after the locks. No presigned URLs.
- ADR 0001's S3-compatible target stays accepted. The S3-compatible adapter, its provider and its deletion and versioning settings arrive with MVP-14.

## Consequences

The activity-record route works with real screenshots. A tall screenshot keeps its native resolution, so text stays legible for MVP-08. Two iOS permission prompts are needed, and each source must work when the other is denied.

Re-encoding gives one stored format and strips metadata, at the cost of GD in the API image and a PHP upload limit above 10 MB. Retry identity compares a hash of the received bytes, not the GD output.

The filesystem adapter adds no service or credentials to local setup. It also keeps proof bytes out of database backups. The S3-compatible adapter stays untested until MVP-14, so storage semantics may need adjustment then. A single API host is assumed until that adapter exists.
