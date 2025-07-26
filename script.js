// Frontend JavaScript (script.js)
document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://script.google.com/macros/s/AKfycbwaLN5wlGAOMCgA1yG0cOsEZJ0LH0qrDDWmm3s8xYdkCER8-WNWm627H0UG72FLHFSgSw/exec';
    const SECRET_TOKEN = 'thisuserislegit06as';

    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('pdf-upload');
    const pdfList = document.getElementById('pdf-list');
    const loader = document.getElementById('loader');

    const modal = document.getElementById('pdf-viewer-modal');
    const closeModal = document.querySelector('.close-button');
    const pdfCanvas = document.getElementById('pdf-canvas');
    const viewerTitle = document.getElementById('pdf-viewer-title');
    const viewerLoader = document.getElementById('viewer-loader');

    // PDF.js state
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    const scale = 1.5;
    const ctx = pdfCanvas.getContext('2d');

    // Controls
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumSpan = document.getElementById('page-num');
    const pageCountSpan = document.getElementById('page-count');


    // --- Core Functions ---

    const showLoader = (list = true) => {
        if (list) loader.style.display = 'block';
        else viewerLoader.style.display = 'block';
    };

    const hideLoader = (list = true) => {
        if (list) loader.style.display = 'none';
        else viewerLoader.style.display = 'none';
    };

    const fetchPDFs = async () => {
        showLoader();
        pdfList.innerHTML = '';
        try {
            const response = await fetch(`${API_URL}?action=listPDFs&token=${SECRET_TOKEN}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const files = await response.json();
            if(files.error) throw new Error(files.error);
            
            hideLoader();
            if (files.length === 0) {
                pdfList.innerHTML = '<li>No PDFs found. Upload one to get started!</li>';
            } else {
                 files.forEach(file => {
                    const li = document.createElement('li');
                    li.dataset.id = file.id;
                    li.innerHTML = `<span class="pdf-name">${file.name}</span>`;
                    li.addEventListener('click', () => openPDF(file.id, file.name));
                    pdfList.appendChild(li);
                });
            }
        } catch (error) {
            hideLoader();
            console.error('Error fetching PDFs:', error);
            pdfList.innerHTML = `<li>Error loading PDFs: ${error.message}</li>`;
        }
    };

    const handleFileUpload = async (file) => {
        if (!file) return;
        if (file.type !== 'application/pdf') {
            alert('Only PDF files are allowed.');
            return;
        }

        showLoader();
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target.result.split(',')[1];
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'uploadPDF',
                        token: SECRET_TOKEN,
                        fileName: file.name,
                        mimeType: file.type,
                        data: base64Data
                    })
                });
                const result = await response.json();
                if (result.success) {
                    alert('File uploaded successfully!');
                    fetchPDFs(); // Refresh the list
                } else {
                    throw new Error(result.error || 'Unknown upload error');
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                alert(`Upload failed: ${error.message}`);
                hideLoader();
            }
        };
        reader.readAsDataURL(file);
    };

    // --- PDF Viewer Functions ---

    const renderPage = num => {
        pageRendering = true;
        pdfDoc.getPage(num).then(page => {
            const viewport = page.getViewport({ scale });
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            const renderTask = page.render(renderContext);

            renderTask.promise.then(() => {
                pageRendering = false;
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
            });
        });

        pageNumSpan.textContent = num;
    };

    const queueRenderPage = num => {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    };

    const onPrevPage = () => {
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    };

    const onNextPage = () => {
        if (pageNum >= pdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    };

    const openPDF = async (fileId, fileName) => {
        modal.style.display = 'block';
        viewerTitle.textContent = 'Loading...';
        showLoader(false);

        // Reset viewer
        if(pdfDoc) {
            pdfDoc.destroy();
            pdfDoc = null;
        }
        ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);


        try {
            const response = await fetch(`${API_URL}?action=getPDF&id=${fileId}&token=${SECRET_TOKEN}`);
             if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            if(!result.success) throw new Error(result.error);
            
            viewerTitle.textContent = fileName;
            const pdfData = atob(result.data);
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;

            const loadingTask = pdfjsLib.getDocument({ data: pdfData });
            pdfDoc = await loadingTask.promise;
            
            hideLoader(false);
            pageCountSpan.textContent = pdfDoc.numPages;
            pageNum = 1;
            renderPage(pageNum);

            prevPageBtn.disabled = pageNum <= 1;
            nextPageBtn.disabled = pageNum >= pdfDoc.numPages;

        } catch (error) {
            console.error('Error opening PDF:', error);
            viewerTitle.textContent = 'Failed to load PDF';
            hideLoader(false);
        }
    };

    // --- Event Listeners ---

    uploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
        if (pdfDoc) {
            pdfDoc.destroy(); // Clean up memory
            pdfDoc = null;
        }
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
             if (pdfDoc) {
                pdfDoc.destroy();
                pdfDoc = null;
            }
        }
    });

    prevPageBtn.addEventListener('click', onPrevPage);
    nextPageBtn.addEventListener('click', onNextPage);


    // Initial Load
    fetchPDFs();
});
