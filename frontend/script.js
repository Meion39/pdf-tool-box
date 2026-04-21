pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// --- Global State & Configuration ---
const AppState = {
    apiBaseUrl: "https://pdf-tool-box.onrender.com",
    selectedPdfFiles: [],
    draggedIndex: null,
    selectedPagesToExtract: new Set(),
    currentPdfObserver: null
};

// --- View Switching Logic ---
function switchView(viewId, btnElement) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeVideoBackground();
    initializeDragAndDrop();
});

function initializeVideoBackground() {
    const video = document.getElementById('background-video');
    const loader = document.getElementById('video-loader');

    const hideLoader = () => {
        loader.style.opacity = '0';
        loader.addEventListener('transitionend', () => {
            loader.style.display = 'none';
        }, { once: true });
    };

    video.addEventListener('canplaythrough', hideLoader);
    video.addEventListener('error', () => {
        console.error("Video Error: Failed to load background video. Check the file path and accessibility.");
        hideLoader(); // Hide loader even if video fails
    });
}

function initializeDragAndDrop() {
    setupDragAndDrop('mergeBox', (files) => addFilesToMerge(files));
    
    setupDragAndDrop('convertBox', (files) => {
        const fileInput = document.getElementById('convertFile');
        if (!files || files.length === 0) return;
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        fileInput.files = dt.files;
    });

    setupDragAndDrop('extractBox', (files) => {
        const fileInput = document.getElementById('extractFile');
        if (!files || files.length === 0) return;
        const dt = new DataTransfer();
        if (files[0].type === 'application/pdf') {
            dt.items.add(files[0]);
            fileInput.files = dt.files;
            loadPdfPreview({ target: fileInput });
        }
    });
}

function setupDragAndDrop(boxId, dropHandler) {
    const box = document.getElementById(boxId);
    const dropHint = document.getElementById(boxId.replace('Box', 'DropHint'));

    const dragEvents = {
        dragover: (e) => {
            e.preventDefault();
            box.classList.add('dragover');
            if (dropHint) dropHint.style.display = 'block';
        },
        dragleave: () => {
            box.classList.remove('dragover');
            if (dropHint) dropHint.style.display = 'none';
        },
        drop: (e) => {
            e.preventDefault();
            box.classList.remove('dragover');
            if (dropHint) dropHint.style.display = 'none';
            if (e.dataTransfer.files.length > 0) {
                dropHandler(e.dataTransfer.files);
            }
        },
        dragenter: (e) => {
            e.preventDefault();
            if (e.dataTransfer.types && (Array.from(e.dataTransfer.types).includes('Files'))) {
                box.classList.add('dragover');
                if (dropHint) dropHint.style.display = 'block';
            }
        }
    };

    for (const [event, handler] of Object.entries(dragEvents)) {
        box.addEventListener(event, handler);
    }
}

// --- Merge PDF Logic ---
function handleFileInput(event) {
    if (event.target.files) {
        addFilesToMerge(event.target.files);
        event.target.value = '';
    }
}

function addFilesToMerge(files) {
    for (let file of files) {
        if (file.type === 'application/pdf') {
            AppState.selectedPdfFiles.push(file);
        }
    }
    renderMergeList();
}

function removePdf(index) {
    AppState.selectedPdfFiles.splice(index, 1);
    renderMergeList();
}

function clearMergeList() {
    AppState.selectedPdfFiles = [];
    renderMergeList();
}

function renderMergeList() {
    const preview = document.getElementById('fileListPreview');
    preview.innerHTML = ''; // Clear previous content

    if (AppState.selectedPdfFiles.length > 0) {
        const list = document.createElement('ul');
        list.style.cssText = "margin: 0; padding: 0; list-style: none;";
        
        AppState.selectedPdfFiles.forEach((file, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'file-item';
            listItem.draggable = true;
            listItem.dataset.index = index;
            listItem.innerHTML = `
                <span style="flex-grow: 1;"><span style="color:#888;margin-right:10px;cursor:grab;">☰</span>${file.name}</span>
                <div class="remove-btn"></div>
            `;
            listItem.querySelector('.remove-btn').onclick = () => removePdf(index);
            list.appendChild(listItem);
        });
        preview.appendChild(list);

        // Add drag and sort events
        addDragSortEvents(list);

        const clearButton = document.createElement('button');
        clearButton.className = 'action-btn';
        clearButton.style.cssText = "margin-top: 15px; background-color: #f44336;";
        clearButton.innerText = 'Clear All Files';
        clearButton.onclick = clearMergeList;
        preview.appendChild(clearButton);
    }
}

function addDragSortEvents(list) {
    const items = list.querySelectorAll('.file-item');
    items.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            AppState.draggedIndex = +this.dataset.index;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => this.style.opacity = '0.4', 0);
        });
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderTop = '2px solid #007acc';
        });
        item.addEventListener('dragleave', function() {
            this.style.borderTop = '1px solid transparent';
        });
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderTop = '1px solid transparent';
            const targetIndex = +this.dataset.index;
            if (AppState.draggedIndex !== targetIndex && AppState.draggedIndex !== null) {
                const draggedFile = AppState.selectedPdfFiles.splice(AppState.draggedIndex, 1)[0];
                AppState.selectedPdfFiles.splice(targetIndex, 0, draggedFile);
                renderMergeList();
            }
        });
        item.addEventListener('dragend', function() {
            this.style.opacity = '1';
        });
    });
}

// --- PDF Page Preview Logic (Lazy Loading) ---
async function loadPdfPreview(event) {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file || file.type !== 'application/pdf') return;

    const grid = document.getElementById('pdfThumbnails');
    const extractBtn = document.getElementById('extractBtn');
    const statusText = document.getElementById('extractStatus');
    
    grid.innerHTML = '<div style="color: #ccc; padding: 20px; grid-column: 1 / -1; text-align: center;">Rendering preview...</div>';
    grid.style.display = 'grid';
    extractBtn.style.display = 'none';
    statusText.innerText = '';
    AppState.selectedPagesToExtract.clear();

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        grid.innerHTML = '';

        if (AppState.currentPdfObserver) AppState.currentPdfObserver.disconnect();
        
        AppState.currentPdfObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const thumbDiv = entry.target;
                    renderPage(pdf, parseInt(thumbDiv.dataset.pageNum), thumbDiv);
                    observer.unobserve(thumbDiv);
                }
            });
        }, { root: grid, rootMargin: '200px' });

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'page-thumbnail';
            thumbDiv.dataset.pageNum = pageNum;
            thumbDiv.style.minHeight = '160px';
            thumbDiv.onclick = () => togglePageSelection(pageNum, thumbDiv);
            
            const label = document.createElement('div');
            label.className = 'page-number-label';
            label.innerText = `Page ${pageNum}`;

            thumbDiv.appendChild(label);
            grid.appendChild(thumbDiv);
            AppState.currentPdfObserver.observe(thumbDiv);
        }
        extractBtn.style.display = 'block';
    } catch (error) {
        grid.innerHTML = `<div style="color: #f44336; grid-column: 1 / -1;">Failed to load PDF preview: ${error.message}</div>`;
    }
}

async function renderPage(pdf, pageNum, thumbDiv) {
    if (thumbDiv.dataset.rendered === 'true') return;
    thumbDiv.dataset.rendered = 'true';

    try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        
        thumbDiv.insertBefore(canvas, thumbDiv.firstChild);
        thumbDiv.style.minHeight = 'auto';
    } catch (error) {
        console.error(`Error rendering page ${pageNum}:`, error);
    }
}

function togglePageSelection(pageNum, element) {
    if (AppState.selectedPagesToExtract.has(pageNum)) {
        AppState.selectedPagesToExtract.delete(pageNum);
        element.classList.remove('selected');
    } else {
        AppState.selectedPagesToExtract.add(pageNum);
        element.classList.add('selected');
    }
}

// --- API Action Handlers ---

async function mergePDFs() {
    if (AppState.selectedPdfFiles.length < 2) {
        const statusText = document.getElementById('mergeStatus');
        statusText.innerText = "Please select at least 2 PDF files to merge.";
        statusText.style.color = "#f44336";
        return;
    }
    const formData = new FormData();
    AppState.selectedPdfFiles.forEach(file => formData.append("files", file));

    await handleApiRequest({
        endpoint: '/merge/',
        formData,
        button: document.getElementById('mergeBtn'),
        statusElement: document.getElementById('mergeStatus'),
        successMessage: '🎉 Success! File downloaded.',
        downloadName: 'Merged_Document.pdf'
    });
}

async function convertFile() {
    const fileInput = document.getElementById('convertFile');
    const file = fileInput.files[0];
    if (!file) { alert("Please select a file first."); return; }

    const formData = new FormData();
    formData.append("file", file);

    await handleApiRequest({
        endpoint: '/convert/',
        formData,
        button: document.getElementById('convertBtn'),
        statusElement: document.getElementById('convertStatus'),
        successMessage: '🎉 Success! File converted.',
        downloadName: `converted_${file.name.split('.')[0]}.pdf`
    });
}

async function extractPages() {
    const fileInput = document.getElementById('extractFile');
    const file = fileInput.files[0];
    const pagesArray = Array.from(AppState.selectedPagesToExtract).sort((a, b) => a - b);

    if (!file) { alert("Please select a PDF file first."); return; }
    if (pagesArray.length === 0) { alert("Please select at least one page to extract."); return; }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("pages", pagesArray.join(','));

    await handleApiRequest({
        endpoint: '/extract/',
        formData,
        button: document.getElementById('extractBtn'),
        statusElement: document.getElementById('extractStatus'),
        successMessage: '🎉 Success! Pages extracted.',
        downloadName: `extracted_${file.name.split('.')[0]}.pdf`
    });
}

// --- Generic API Request Helper ---
async function handleApiRequest({ endpoint, formData, button, statusElement, successMessage, downloadName }) {
    const originalButtonText = button.innerText;
    statusElement.innerText = "Processing, please wait...";
    statusElement.style.color = "#ffeb3b";
    button.disabled = true;
    button.innerText = "Processing...";
    button.classList.add('loading');

    try {
        const response = await fetch(`${AppState.apiBaseUrl}${endpoint}`, { method: "POST", body: formData });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Request failed");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        statusElement.innerText = successMessage;
        statusElement.style.color = "#4CAF50";
    } catch (error) {
        statusElement.innerText = `❌ Error: ${error.message}`;
        statusElement.style.color = "#f44336";
        console.error("API Error:", error);
    } finally {
        button.disabled = false;
        button.innerText = originalButtonText;
        button.classList.remove('loading');
    }
}