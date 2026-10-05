// Versioned records in the existing message history preserve older conversations.
// Only the enquiry endpoints may write this reserved format.
export const INQUIRY_PREFIX = '[NAKATHATA_ENQUIRY_V1]';
export type InquiryRecord = {
  kind: 'INQUIRY';
  eventDate: string;
  location: string;
  guestCount: number;
  requirements: string;
  packageId?: string;
  listingName?: string;
};
export type ResponseRecord = {
  kind: 'RESPONSE';
  inquiryId: string;
  action: 'REPLIED' | 'NEEDS_DETAILS' | 'DECLINED';
  text: string;
};
export function readInquiryRecord(
  content: string,
): InquiryRecord | ResponseRecord | null {
  if (!content?.startsWith(INQUIRY_PREFIX)) return null;
  try {
    const value = JSON.parse(content.slice(INQUIRY_PREFIX.length));
    if (
      value.kind === 'INQUIRY' &&
      typeof value.eventDate === 'string' &&
      typeof value.location === 'string' &&
      Number.isInteger(value.guestCount) &&
      typeof value.requirements === 'string'
    )
      return value;
    if (
      value.kind === 'RESPONSE' &&
      typeof value.inquiryId === 'string' &&
      ['REPLIED', 'NEEDS_DETAILS', 'DECLINED'].includes(value.action) &&
      typeof value.text === 'string'
    )
      return value;
  } catch {
    /* Ordinary legacy text is left untouched. */
  }
  return null;
}
export const inquiryContent = (record: InquiryRecord | ResponseRecord) =>
  INQUIRY_PREFIX + JSON.stringify(record);
