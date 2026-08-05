# Listingify Tesseract OCR Runtime

Listingify uses `pdfjs-dist`, `@napi-rs/canvas`, and `tesseract.js` from
`web/package.json` for server-side hangtag and wash-label OCR. The language data
under `vendor/tesseract/lang/` is intentionally committed so OCR does not depend
on a system `tesseract` binary or a runtime CDN download.

Bundled language packs:

- `chi_sim.traineddata.gz`
- `eng.traineddata.gz`
