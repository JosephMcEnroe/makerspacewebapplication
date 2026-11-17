import { Document, Page, pdfjs } from "react-pdf";
import styles from "./TermOfServiceForm.module.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

export default function PdfViewer({
    file,
    pageWidth,
    numPages,
    onLoadSuccess,
}) {
    return (
        <Document
            file={file}
            onLoadSuccess={onLoadSuccess}
            onLoadError={(error) =>
                console.error("PDF error:", error)
            }
            loading={<p>Loading TOS...</p>}
            error={<p>Unable to load TOS PDF.</p>}
        >
            {Array.from(
                { length: numPages || 0 },
                (_, index) => (
                    <div
                        key={index}
                        className={styles.pdfPage}
                    >
                        <Page
                            pageNumber={index + 1}
                            width={pageWidth}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                        />
                    </div>
                )
            )}
        </Document>
    );
}