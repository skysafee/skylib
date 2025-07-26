// script.js
const API_URL = 'https://script.google.com/macros/s/AKfycby_rGJnO67MmQJ1ddrpehA4vWNJ2ZJ1f9vGSEkYAMbPtCTUkgJNT8SPzepO0bsOks4Kxg/exec'; // Replace with real one
const SECRET_TOKEN = 'thisuserislegit06as';

document.addEventListener('DOMContentLoaded', () => {
  const uploadBtn = document.getElementById('upload-button');
  const fileInput = document.getElementById('pdf-upload');
  const pdfList = document.getElementById('pdf-list');
  const loader = document.getElementById('loader');
  const modal = document.getElementById('pdf-viewer-modal');
  const closeModal = document.querySelector('.close-button');
  const pdfCanvas = document.getElementById('pdf-canvas');
  const viewerTitle = document.getElementById('pdf-viewer-title');
  const viewerLoader = document.getElementById('viewer-loader');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const pageNumSpan = document.getElementById('page-num');
  const pageCountSpan = document.getElementById('page-count');

  let pdfDoc = null, pageNum = 1, pageRendering = false, pageNumPending = null;
  const scale = 1.5, ctx = pdfCanvas.getContext('2d');

  // Upload trigger
  uploadBtn.onclick = () => fileInput.click();
  fileInput.onchange = () => handleFileUpload(fileInput.files[0]);

  const showLoader = () => loader.style.display = 'block';
  const hideLoader = () => loader.style.display = 'none';

  async function handleFileUpload(file) {
    if (!file || file.type !== 'application/pdf') {
      alert('Only PDF files are supported.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File size exceeds 50MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      try {
        showLoader();
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'uploadPDF',
            token: SECRET_TOKEN,
            fileName: file.name,
            mimeType: file.type,
            data: base64
          })
        });
        const result = await res.json();
        if (result.success) {
          alert('Upload successful!');
          loadPDFList();
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        alert('Upload failed: ' + err.message);
      } finally {
        hideLoader();
      }
    };
    reader.readAsDataURL(file);
  }

  async function loadPDFList() {
    try {
      showLoader();
      pdfList.innerHTML = '';
      const res = await fetch(`${API_URL}?action=listPDFs&token=${SECRET_TOKEN}`);
      const files = await res.json();
      if (files.length === 0) {
        pdfList.innerHTML = '<li>No PDFs yet.</li>';
        return;
      }
      files.forEach(file => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="pdf-name">${file.name}</span>`;
        li.onclick = () => openPDF(file.id, file.name);
        pdfList.appendChild(li);
      });
    } catch (err) {
      pdfList.innerHTML = `<li>Error loading PDFs</li>`;
      console.error(err);
    } finally {
      hideLoader();
    }
  }

  async function openPDF(fileId, fileName) {
    modal.style.display = 'block';
    viewerTitle.textContent = 'Loading...';
    viewerLoader.style.display = 'block';

    if (pdfDoc) {
      pdfDoc.destroy();
      pdfDoc = null;
    }
    ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

    try {
      const res = await fetch(`${API_URL}?action=getPDF&id=${fileId}&token=${SECRET_TOKEN}`);
      const { data } = await res.json();
      const binary = atob(data);
      const uint8 = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) uint8[i] = binary.charCodeAt(i);

      const loadingTask = pdfjsLib.getDocument({ data: uint8 });
      pdfDoc = await loadingTask.promise;
      pageCountSpan.textContent = pdfDoc.numPages;
      pageNum = 1;
      renderPage(pageNum);
    } catch (err) {
      alert('Failed to load PDF');
      console.error(err);
    } finally {
      viewerLoader.style.display = 'none';
      viewerTitle.textContent = fileName;
    }
  }

  function renderPage(num) {
    pageRendering = true;
    pdfDoc.getPage(num).then(page => {
      const viewport = page.getViewport({ scale });
      pdfCanvas.height = viewport.height;
      pdfCanvas.width = viewport.width;
      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTask.promise.then(() => {
        pageRendering = false;
        if (pageNumPending !== null) renderPage(pageNumPending);
      });
    });
    pageNumSpan.textContent = num;
    prevPageBtn.disabled = num <= 1;
    nextPageBtn.disabled = num >= pdfDoc.numPages;
  }

  prevPageBtn.onclick = () => { if (pageNum > 1) renderPage(--pageNum); };
  nextPageBtn.onclick = () => { if (pageNum < pdfDoc.numPages) renderPage(++pageNum); };
  closeModal.onclick = () => modal.style.display = 'none';

  window.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

  // PWA install prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-banner').style.display = 'block';
    document.getElementById('install-button').onclick = () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(() => deferredPrompt = null);
    };
  });

  loadPDFList();
});
