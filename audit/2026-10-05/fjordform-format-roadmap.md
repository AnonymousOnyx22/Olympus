# Fjordform format roadmap

Owner's request (2026-10-07): study what other converter tools support and make Fjordform support every file type, "ipynb to pdf" and every single one. This file is the plan the agent builds from, one wave at a time.

## What the big converters offer (fetched 2026-10-07)
- CloudConvert: 212 formats in 11 categories: documents (23), images (42), video (28), audio (21), spreadsheets (8), presentations (11), ebooks (22), archives (39), vector (10), CAD (3), fonts (5). Its own most popular conversions: PDF to DOCX, DOCX to PDF, HTML to TXT. It says it picks vendor engines and open source converters per file type, on servers.
- Convertio: 10 categories (archives, audio 80+ formats, CAD, documents, ebooks, fonts, images including camera RAW, presentations, vectors, video 40+ formats). Over 3 billion files converted.
- Notebook to PDF is searched constantly by students and data scientists. Rivals: ipynb.app, Vertopal (50 MB limit, uploads files), Rare2PDF, and the nbconvert command line which needs LaTeX. A private, instant, no upload version is a real gap.

## The honest limit
Those sites convert on servers. Fjordform converts inside the visitor's browser, which is its selling point (private, instant, no limits) but means some things cannot be matched:
- Accurate Word, Excel or PowerPoint to PDF needs a full office engine. A WebAssembly build of LibreOffice exists but is over 100 MB, so it may only ever be an optional, clearly labelled download.
- PDF to editable DOCX with real layout cannot be done well in a browser. Do not fake it. Offer text extraction and say so.
- Proprietary formats with no usable open library (CorelDRAW CDR, AutoCAD DWG, Apple Pages and Keynote, most RAW camera files at full fidelity) are out unless a legal, working open library exists. List them on the formats page as not supported, with the reason.
- "Every single one" is not achievable. "Every format a browser can honestly convert, plus clear answers for the rest" is, and that is what gets built.

## Rules for every format added
1. Runs fully in the browser, nothing uploaded. Vendor the library locally with its licence file. Check the licence (MIT, BSD, Apache, MPL are fine; LGPL only if loaded as a separate file and the notice is shown; avoid GPL and anything unclear, and write down the decision).
2. Load heavy WebAssembly only when that conversion is chosen, never on the home page. Keep first load under 60 KB of JavaScript.
3. Same experience as images: drop, auto convert at maximum quality, one Download button, no settings.
4. Real fixture file per input format. Test every supported pair in a real browser, check the output by signature and by reading it back. Record the pass or fail table in STORE-LOG.md.
5. A dedicated page only for pairs people really search. Own honest intro, FAQ, how it works and related links. Everything else is reachable through the hub.
6. Copy rules, SEO rules, accessibility rules and the build checks stay exactly as they are. Update the sitemap, tools page and formats page every wave.
7. If a conversion cannot be done well, say so on the page. Never ship something that produces broken output.

## Waves (build one at a time, deploy and verify live after each)
Wave 1: documents and notebooks, pure JavaScript, small
- ipynb to PDF, HTML, Markdown, TXT, DOCX (parse the notebook JSON, render markdown, code cells and stored outputs including images, then print layout to PDF)
- Markdown to HTML, PDF, DOCX, TXT. HTML to PDF, TXT, Markdown. TXT to PDF, DOCX.
- DOCX to HTML, TXT, PDF, Markdown (mammoth.js, BSD). ODT and RTF to TXT, HTML, PDF where a clean library exists.
- EPUB to PDF, TXT, HTML. FB2 to HTML and TXT.
- Merge PDF and Split PDF (job 3), then PDF to TXT, rotate pages, extract images.
Wave 2: data and code
- CSV, TSV, JSON, XML, YAML, TOML in every direction. XLSX and ODS to CSV, JSON, HTML, PDF and back (SheetJS, Apache 2.0). SQL and JSON line formats.
- Code and text files to PDF with syntax highlighting. JSON formatter and validator pages are high volume.
- Base64, URL and HTML entity encode and decode, Unix timestamp, UUID, hash pages only if they can be honest single purpose tools.
- Subtitles: SRT, VTT, ASS, SBV, in every direction.
Wave 3: archives and fonts
- ZIP create and extract, TAR, GZ, BZ2, 7z and RAR read (libarchive WebAssembly, BSD), convert between them.
- TTF, OTF, WOFF, WOFF2 in every direction (opentype.js, wawoff2).
Wave 4: more images and vectors
- JPEG XL, PSD flatten, TGA, DDS, PCX, ICNS, JP2, QOI, APNG, animated WebP and GIF both ways, camera RAW where an open library works, SVG to PDF, EPS and AI preview where possible, DXF to SVG, STL and OBJ to PNG preview.
Wave 5: audio and video (heaviest)
- WAV, MP3, OGG, FLAC, AAC, M4A and others, MP4, WebM, MOV, MKV, GIF from video, video to MP3. Prefer WebCodecs and a small muxer library. ffmpeg.wasm is possible but is huge and its default builds may be GPL: only use it if the licence and size are acceptable and it loads on demand. Show a progress bar, allow cancel, limit file size to what a phone can hold and say so.
Wave 6: optional office engine
- DOCX, XLSX, PPTX and ODF to PDF with a lazily loaded office WebAssembly build, clearly labelled as large. Skip if the licence, size or quality is not acceptable.

## Selection of what to build first inside a wave
Search demand first. The agent uses autocomplete and related searches to rank the pairs, builds the top ones, and writes the evidence into STORE-LOG.md.

## Status
| Wave | State |
| --- | --- |
| 0 images, PDF to images, images to PDF | live, 49 pages |
| Merge PDF, Split PDF | agent running (job 3) |
| 1 | next |
