import * as pdfjsLib from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

// Vite: a real worker port is the reliable way to boot the pdf.js worker.
// Using `?url` + workerSrc leaves getDocument's promise pending forever when
// the module worker cannot be spawned from a static asset URL.
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

export { pdfjsLib };
