/**
 * Tracking Link Generation Utility
 *
 * Generates clickable tracking links for various shipping carriers
 * with automatic carrier detection based on tracking number patterns.
 */

export type ShippingCarrier = 'UPS' | 'FEDEX' | 'USPS' | 'DHL' | 'ONTRAC' | 'UNKNOWN';

export interface TrackingLinkResult {
  carrier: ShippingCarrier;
  url: string;
  displayName: string;
}

/**
 * Carrier tracking URL templates
 */
const CARRIER_URLS: Record<ShippingCarrier, (trackingNumber: string) => string> = {
  UPS: (num) => `https://www.ups.com/track?tracknum=${num}`,
  FEDEX: (num) => `https://www.fedex.com/fedextrack/?trknbr=${num}`,
  USPS: (num) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`,
  DHL: (num) => `https://www.dhl.com/en/express/tracking.html?AWB=${num}`,
  ONTRAC: (num) => `https://www.ontrac.com/tracking/?number=${num}`,
  UNKNOWN: (num) => `https://www.google.com/search?q=${encodeURIComponent(num + ' tracking')}`,
};

/**
 * Carrier display names
 */
const CARRIER_DISPLAY_NAMES: Record<ShippingCarrier, string> = {
  UPS: 'UPS',
  FEDEX: 'FedEx',
  USPS: 'USPS',
  DHL: 'DHL',
  ONTRAC: 'OnTrac',
  UNKNOWN: 'Search',
};

/**
 * Detects shipping carrier from tracking number pattern
 *
 * Pattern recognition based on common carrier formats:
 * - UPS: 1Z followed by 16 chars, or tracking numbers starting with specific prefixes
 * - FedEx: 12 or 15 digits, or starts with specific patterns
 * - USPS: 20-22 digits, or specific USPS patterns (94, 92, 93, etc.)
 * - DHL: 10-11 digits
 * - OnTrac: Starts with 'C' followed by 14 digits
 */
function detectCarrier(trackingNumber: string): ShippingCarrier {
  const cleaned = trackingNumber.trim().toUpperCase().replace(/[\s-]/g, '');

  // UPS patterns
  if (/^1Z[A-Z0-9]{16}$/.test(cleaned)) {
    return 'UPS';
  }
  if (/^(T|H|K|D)\d{10}$/.test(cleaned)) {
    return 'UPS';
  }

  // FedEx patterns
  if (/^\d{12}$/.test(cleaned) || /^\d{15}$/.test(cleaned)) {
    return 'FEDEX';
  }
  if (/^\d{20}$/.test(cleaned)) {
    return 'FEDEX';
  }
  if (/^96\d{20}$/.test(cleaned)) {
    return 'FEDEX';
  }

  // USPS patterns
  if (/^(94|93|92|82|91|95)\d{20}$/.test(cleaned)) {
    return 'USPS';
  }
  if (/^(94|93|92|82|91|95)\d{18}$/.test(cleaned)) {
    return 'USPS';
  }
  if (/^[A-Z]{2}\d{9}US$/.test(cleaned)) {
    return 'USPS';
  }
  if (/^E[A-Z]\d{9}[A-Z]{2}$/.test(cleaned)) {
    return 'USPS';
  }

  // DHL patterns
  if (/^\d{10,11}$/.test(cleaned)) {
    return 'DHL';
  }

  // OnTrac patterns
  if (/^C\d{14}$/.test(cleaned)) {
    return 'ONTRAC';
  }

  return 'UNKNOWN';
}

/**
 * Generates a tracking link with carrier detection
 *
 * @param trackingNumber - The tracking number to generate a link for
 * @param carrier - Optional explicit carrier (if known). If not provided, will auto-detect
 * @returns TrackingLinkResult with carrier, URL, and display name
 *
 * @example
 * ```ts
 * const result = generateTrackingLink('1Z999AA10123456784');
 * // { carrier: 'UPS', url: 'https://www.ups.com/track?tracknum=1Z999AA10123456784', displayName: 'UPS' }
 *
 * const result2 = generateTrackingLink('123456789012', 'FEDEX');
 * // { carrier: 'FEDEX', url: 'https://www.fedex.com/fedextrack/?trknbr=123456789012', displayName: 'FedEx' }
 * ```
 */
export function generateTrackingLink(
  trackingNumber: string,
  carrier?: ShippingCarrier
): TrackingLinkResult {
  if (!trackingNumber || !trackingNumber.trim()) {
    return {
      carrier: 'UNKNOWN',
      url: '#',
      displayName: 'No tracking number',
    };
  }

  const detectedCarrier = carrier || detectCarrier(trackingNumber);
  const url = CARRIER_URLS[detectedCarrier](trackingNumber.trim());
  const displayName = CARRIER_DISPLAY_NAMES[detectedCarrier];

  return {
    carrier: detectedCarrier,
    url,
    displayName,
  };
}

/**
 * Normalizes carrier name from various formats to our ShippingCarrier type
 * Useful when processing data from external sources that may use different naming
 *
 * @param carrierName - Carrier name in any format
 * @returns Normalized ShippingCarrier type
 *
 * @example
 * ```ts
 * normalizeCarrierName('ups') // 'UPS'
 * normalizeCarrierName('FedEx') // 'FEDEX'
 * normalizeCarrierName('Unknown Carrier') // 'UNKNOWN'
 * ```
 */
export function normalizeCarrierName(carrierName?: string | null): ShippingCarrier {
  if (!carrierName) return 'UNKNOWN';

  const normalized = carrierName.trim().toUpperCase().replace(/[\s-]/g, '');

  if (normalized.includes('UPS')) return 'UPS';
  if (normalized.includes('FEDEX') || normalized.includes('FED')) return 'FEDEX';
  if (normalized.includes('USPS') || normalized.includes('POSTAL')) return 'USPS';
  if (normalized.includes('DHL')) return 'DHL';
  if (normalized.includes('ONTRAC')) return 'ONTRAC';

  return 'UNKNOWN';
}
