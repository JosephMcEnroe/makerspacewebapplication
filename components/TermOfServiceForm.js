
import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useAuth } from "@/hooks/useAuth";
import styles from "./TermOfServiceForm.module.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

export default function TermOfServiceForm() {
    const router = useRouter();
    const containerRef = useRef(null);
    const contentRef = useRef(null);

    const [numPages, setNumPages] = useState(null);
    const [pageWidth, setPageWidth] = useState(800);
    const [reachedBottom, setReachedBottom] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const { signup } = useAuth();
    // Responsive PDF width
    useEffect(() => {
        const container = containerRef.current;

        if (!container) return;

        const observer = new ResizeObserver(() => {
            setPageWidth(
                Math.max(250, container.clientWidth - 32)
            );
        });

        observer.observe(container);

        return () => observer.disconnect();
    }, []);

    // Detect bottom of PDF
    function handleScroll() {
        const container = containerRef.current;

        if (!container) return;

        const atBottom =
            container.scrollTop + container.clientHeight >=
            container.scrollHeight - 10;

        if (atBottom) {
            setReachedBottom(true);
        }
    }

    // Handle short PDFs and asynchronously rendered pages
    useEffect(() => {
        const container = containerRef.current;
        const content = contentRef.current;

        if (!container || !content || !numPages) return;

        function checkBottom() {
            if (
                container.scrollHeight <=
                container.clientHeight + 10
            ) {
                setReachedBottom(true);
            }
        }

        const observer = new ResizeObserver(checkBottom);

        observer.observe(content);
        checkBottom();

        return () => observer.disconnect();
    }, [numPages, pageWidth]);

    async function handleAccept() {
        if (!reachedBottom || !accepted ) return;

        //saved data after filling register form and bring to tos page
        const savedData = sessionStorage.getItem("pendingRegister");

        try {

            const saveddata = JSON.parse(savedData);

            // Create account AFTER TOS acceptance
            const result = await signup(
                saveddata.firstName,
                saveddata.lastName,
                saveddata.email,
                saveddata.password
            );
            if (!result) {
                return;
            }

            // Go to dashboard
            router.push("/dashboard");

        } catch (error) {
            console.error("Registration error:", error);
        }
    }

    return (
        <div>
            {/* PDF document */}
            <div
                ref={containerRef}
                className={styles.pdfContainer}
                onScroll={handleScroll}
            >
                <div ref={contentRef}>
                    <Document
                        file="/tos/TOS.pdf"
                        onLoadSuccess={({ numPages }) =>
                            setNumPages(numPages)
                        }
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
                </div>
            </div>

            {/* Reached bottom notification */}
            {reachedBottom && (
                <p className={styles.successMessage}>
                    ✓ You've reached the end of the document.
                </p>
            )}

            {/* Agreement checkbox */}
            <div className={styles.checkboxContainer}>
                <input
                    type="checkbox"
                    id="acceptTOS"
                    disabled={!reachedBottom}
                    checked={accepted}
                    onChange={(e) =>
                        setAccepted(e.target.checked)
                    }
                />

                <label htmlFor="acceptTOS">
                    I have read and agree to the Terms
                    of Service.
                </label>
            </div>

            {/* Accept button */}
            <div className={styles.buttonContainer}>
                <button
                    type="button"
                    disabled={!reachedBottom || !accepted}
                    onClick={handleAccept}
                    className={styles.acceptButton}
                >
                    Accept and Continue →
                </button>
            </div>
        </div>
    );
}
