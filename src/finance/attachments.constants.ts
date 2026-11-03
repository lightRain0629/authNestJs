/** 20 MB — a year of exchange statements, not a video. */
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export const ATTACHMENTS_DIR_ENV = 'FINANCE_ATTACHMENTS_DIR';
export const ATTACHMENTS_DIR_DEFAULT = './storage/finance-attachments';

/**
 * What a client may label a file as when it does not know better. Browsers
 * fall back to these for types the OS has no registration for (xlsx on a bare
 * Linux box, csv on some Windows setups), so they are accepted for every
 * extension and the content check below has the final say.
 */
const GENERIC_MIME_TYPES = ['', 'application/octet-stream'];

type AttachmentType = {
  /** The type the file is stored and served as, whatever the client claimed. */
  mimeType: string;
  /** Types a client may plausibly send for this extension. */
  accepts: string[];
  /** Does the start of the file look like this format? */
  sniff: (head: Buffer) => boolean;
};

const startsWith = (head: Buffer, bytes: number[]) =>
  head.length >= bytes.length && bytes.every((b, i) => head[i] === b);

/** Text formats carry no signature; a NUL byte is the tell of a binary. */
const looksLikeText = (head: Buffer) => !head.includes(0);

const PDF: AttachmentType = {
  mimeType: 'application/pdf',
  accepts: ['application/pdf', 'application/x-pdf'],
  sniff: (head) => startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d]), // %PDF-
};

const JPEG: AttachmentType = {
  mimeType: 'image/jpeg',
  accepts: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  sniff: (head) => startsWith(head, [0xff, 0xd8, 0xff]),
};

/**
 * The allow-list, keyed by lower-case extension. Anything not here is refused,
 * whatever its content.
 */
export const ATTACHMENT_TYPES: Record<string, AttachmentType> = {
  pdf: PDF,
  png: {
    mimeType: 'image/png',
    accepts: ['image/png'],
    sniff: (head) =>
      startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  jpg: JPEG,
  jpeg: JPEG,
  webp: {
    mimeType: 'image/webp',
    accepts: ['image/webp'],
    sniff: (head) =>
      head.length >= 12 &&
      head.toString('latin1', 0, 4) === 'RIFF' &&
      head.toString('latin1', 8, 12) === 'WEBP',
  },
  xlsx: {
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    accepts: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-zip-compressed',
    ],
    sniff: (head) => startsWith(head, [0x50, 0x4b, 0x03, 0x04]), // zip
  },
  xls: {
    mimeType: 'application/vnd.ms-excel',
    accepts: [
      'application/vnd.ms-excel',
      'application/msexcel',
      'application/x-msexcel',
      'application/x-excel',
      'application/x-ole-storage',
    ],
    // OLE2 compound document
    sniff: (head) =>
      startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  },
  csv: {
    mimeType: 'text/csv',
    accepts: [
      'text/csv',
      'text/x-csv',
      'application/csv',
      'text/comma-separated-values',
      'text/plain',
      // What Windows reports for .csv when Excel is installed.
      'application/vnd.ms-excel',
    ],
    sniff: looksLikeText,
  },
  txt: {
    mimeType: 'text/plain',
    accepts: ['text/plain'],
    sniff: looksLikeText,
  },
};

export const ATTACHMENT_EXTENSIONS = Object.keys(ATTACHMENT_TYPES);

/** How much of the file the content check reads. */
export const ATTACHMENT_SNIFF_BYTES = 8 * 1024;

export function attachmentExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** The type for this file name if its extension is allowed, else null. */
export function attachmentTypeFor(fileName: string): AttachmentType | null {
  return ATTACHMENT_TYPES[attachmentExtension(fileName)] ?? null;
}

export function isAcceptedClientMimeType(
  type: AttachmentType,
  clientMimeType: string | undefined,
): boolean {
  const claimed = (clientMimeType ?? '').split(';')[0].trim().toLowerCase();
  return GENERIC_MIME_TYPES.includes(claimed) || type.accepts.includes(claimed);
}
