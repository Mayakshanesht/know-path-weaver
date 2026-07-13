// ?inline forces Vite to emit a base64 data URI rather than a URL. That is required:
// the certificate SVG is rasterised to PNG through a canvas, and a canvas drawing an
// SVG that references an external image is tainted — toBlob() then throws and the
// download silently fails. A data URI keeps the whole thing self-contained.
import logoDataUri from '@/assets/knowgraph-logo-mark.png?inline';

export interface CertificateData {
  studentName: string;
  courseTitle: string;
  completionDate: string;
  instructorName: string;
  organization?: string;
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function createCertificateSvg({
  studentName,
  courseTitle,
  completionDate,
  instructorName,
  organization = 'KnowGraph',
}: CertificateData) {
  const safeStudentName = escapeXml(studentName || 'Learner');
  const safeCourseTitle = escapeXml(courseTitle || 'Course');
  const safeCompletionDate = escapeXml(completionDate || '');
  const safeInstructorName = escapeXml(instructorName || '');
  const safeOrganization = escapeXml(organization);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850">
  <defs>
    <linearGradient id="backgroundGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.6" />
    </linearGradient>
  </defs>
  <rect width="1200" height="850" fill="#f8fafc" />
  <rect x="40" y="40" width="1120" height="770" rx="40" fill="#0f172a" opacity="0.08" />
  <rect x="80" y="80" width="1040" height="690" rx="30" fill="url(#backgroundGradient)" opacity="0.15" />

  <image href="${logoDataUri}" x="480" y="118" width="240" height="76" preserveAspectRatio="xMidYMid meet" />

  <text x="600" y="248" text-anchor="middle" fill="#111827" font-family="Inter, sans-serif" font-size="38" font-weight="700" letter-spacing="1">Certificate of Completion</text>

  <text x="600" y="316" text-anchor="middle" fill="#475569" font-family="Inter, sans-serif" font-size="20">This certificate is proudly awarded to</text>
  <text x="600" y="382" text-anchor="middle" fill="#0f172a" font-family="Inter, sans-serif" font-size="52" font-weight="800">${safeStudentName}</text>

  <text x="600" y="450" text-anchor="middle" fill="#475569" font-family="Inter, sans-serif" font-size="22">for successfully completing</text>
  <text x="600" y="506" text-anchor="middle" fill="#0f172a" font-family="Inter, sans-serif" font-size="36" font-weight="700">${safeCourseTitle}</text>

  <text x="600" y="566" text-anchor="middle" fill="#475569" font-family="Inter, sans-serif" font-size="18">Completed ${safeCompletionDate}</text>

  <line x1="230" y1="610" x2="470" y2="610" stroke="#cbd5e1" stroke-width="2" />
  <text x="350" y="655" text-anchor="middle" fill="#475569" font-family="Inter, sans-serif" font-size="18">Instructor</text>
  <text x="350" y="690" text-anchor="middle" fill="#0f172a" font-family="Inter, sans-serif" font-size="20" font-weight="600">${safeInstructorName}</text>

  <line x1="730" y1="610" x2="970" y2="610" stroke="#cbd5e1" stroke-width="2" />
  <text x="850" y="655" text-anchor="middle" fill="#475569" font-family="Inter, sans-serif" font-size="18">Organization</text>
  <text x="850" y="690" text-anchor="middle" fill="#0f172a" font-family="Inter, sans-serif" font-size="20" font-weight="600">${safeOrganization}</text>

  <text x="600" y="760" text-anchor="middle" fill="#94a3b8" font-family="Inter, sans-serif" font-size="16">Powered by KnowGraph — Transforming learners into confident AI-first professionals</text>
</svg>`;
}

function triggerDownload(url: string, fileName: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Downloads the certificate as a PNG.
 *
 * It used to download raw SVG. That is a fine format for a browser and a poor one for
 * a human: most people cannot open it, Word and PowerPoint will not place it, and
 * LinkedIn will not accept it as a credential image. A certificate exists to be shown
 * to someone else, so it has to be a format they can actually open.
 *
 * Rendered at 2x so it stays sharp when printed or posted.
 */
export async function downloadCertificate(data: CertificateData): Promise<void> {
  const svg = createCertificateSvg(data);
  const safeName = data.courseTitle.replace(/[^a-zA-Z0-9_-]+/g, '_');

  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const png = await new Promise<Blob>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = 1200 * scale;
        canvas.height = 850 * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas is unavailable.'));

        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0, 1200, 850);

        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))),
          'image/png'
        );
      };
      image.onerror = () => reject(new Error('Could not render the certificate.'));
      image.src = svgUrl;
    });

    const pngUrl = URL.createObjectURL(png);
    triggerDownload(pngUrl, `${safeName}_certificate.png`);
    URL.revokeObjectURL(pngUrl);
  } catch {
    // Rasterising can fail (an old browser, a blocked canvas). A downloadable SVG
    // beats no certificate at all.
    triggerDownload(svgUrl, `${safeName}_certificate.svg`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
