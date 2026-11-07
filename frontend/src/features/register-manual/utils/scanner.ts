export function createScanHints(library: typeof import('@zxing/library')) {
  const formats = [
    library.BarcodeFormat.QR_CODE,
    library.BarcodeFormat.CODE_128,
    library.BarcodeFormat.CODE_39,
    library.BarcodeFormat.CODE_93,
    library.BarcodeFormat.EAN_13,
    library.BarcodeFormat.EAN_8,
    library.BarcodeFormat.UPC_A,
    library.BarcodeFormat.UPC_E,
    library.BarcodeFormat.ITF,
    library.BarcodeFormat.DATA_MATRIX,
    library.BarcodeFormat.PDF_417,
  ];
  const hints = new Map<import('@zxing/library').DecodeHintType, import('@zxing/library').BarcodeFormat[]>();
  hints.set(library.DecodeHintType.POSSIBLE_FORMATS, formats);
  return hints;
}

