/* ============================================================
   BIBLIOTECA LUNAR — lógica de la interfaz
   ============================================================ */

(function () {
    'use strict';

    /* ---------- Utilidades ---------- */
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function coverFallbackHTML(title) {
        return `<div class="book-cover-fallback">
                    <i class="bi bi-book fallback-icon"></i>
                    <div class="fallback-title">${escapeHtml(title)}</div>
                </div>`;
    }

    /* ---------- Render de la cuadrícula ---------- */
    function renderBooks(booksToRender) {
        const container = document.getElementById('booksContainer');
        const noResults = document.getElementById('noResults');
        const searchCount = document.getElementById('searchCount');

        container.innerHTML = '';

        if (booksToRender.length === 0) {
            noResults.classList.remove('is-hidden');
            return;
        }
        noResults.classList.add('is-hidden');

        const fragment = document.createDocumentFragment();

        booksToRender.forEach((book, index) => {
            const card = document.createElement('div');
            card.className = 'book-card';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `Ver ${book.title}`);

            const hasCover = book.cover && book.cover.trim() !== '';
            const coverHTML = hasCover
                ? `<img src="${encodeURI(book.cover)}" alt="Portada de ${escapeHtml(book.title)}" class="book-cover-img" loading="lazy">`
                : coverFallbackHTML(book.title);

            card.innerHTML = `
                <div class="book-cover-wrapper">
                    ${coverHTML}
                    <div class="book-cover-shade"></div>
                </div>
                <div class="book-info">
                    <h3 class="book-title-text">${escapeHtml(book.title)}</h3>
                    <div class="book-author-text">${escapeHtml(book.author)}</div>
                    <div class="book-year-text">${escapeHtml(book.year)}</div>
                </div>
            `;

            if (hasCover) {
                const img = card.querySelector('.book-cover-img');
                img.addEventListener('error', function () {
                    this.closest('.book-cover-wrapper').innerHTML =
                        coverFallbackHTML(book.title) + '<div class="book-cover-shade"></div>';
                });
            }

            const open = () => openBookDetail(book);
            card.addEventListener('click', open);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open();
                }
            });

            fragment.appendChild(card);
        });

        container.appendChild(fragment);

        if (searchCount) {
            const total = books.length;
            const shown = booksToRender.length;
            searchCount.textContent = shown === total
                ? `${total} historias en la colección`
                : `${shown} de ${total} historias encontradas`;
        }
    }

    /* ============================================================
       Vista de detalle del libro
       ============================================================ */
    const detailOverlay = document.getElementById('bookDetail');
    const detailCoverFrame = document.getElementById('detailCoverFrame');
    const detailTitle = document.getElementById('detailTitle');
    const detailMeta = document.getElementById('detailMeta');
    const detailAuthor = document.getElementById('detailAuthor');
    const detailYear = document.getElementById('detailYear');
    const detailDescription = document.getElementById('detailDescription');
    const detailReadBtn = document.getElementById('detailReadBtn');
    const detailDownloadBtn = document.getElementById('detailDownloadBtn');

    let lastFocusedElement = null;

    function openBookDetail(book) {
        lastFocusedElement = document.activeElement;

        const hasCover = book.cover && book.cover.trim() !== '';
        detailCoverFrame.innerHTML = hasCover
            ? `<img src="${encodeURI(book.cover)}" alt="Portada de ${escapeHtml(book.title)}">`
            : `<div class="detail-cover-fallback"><i class="bi bi-book"></i></div>`;

        if (hasCover) {
            const img = detailCoverFrame.querySelector('img');
            img.addEventListener('error', function () {
                detailCoverFrame.innerHTML = `<div class="detail-cover-fallback"><i class="bi bi-book"></i></div>`;
            });
        }

        detailTitle.textContent = book.title;
        detailMeta.textContent = `${book.author} · ${book.year}`;
        detailAuthor.textContent = book.author;
        detailYear.textContent = book.year;
        detailDescription.textContent = book.description;

        detailReadBtn.onclick = () => openReader(book.file, book.title);
        detailDownloadBtn.href = encodeURI(book.file);
        detailDownloadBtn.setAttribute('download', book.title + '.pdf');

        detailOverlay.classList.add('is-open');
        detailOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Mueve el foco al panel para lectores de pantalla y navegación por teclado
        document.getElementById('detailClose').focus();
    }

    function closeBookDetail() {
        detailOverlay.classList.remove('is-open');
        detailOverlay.setAttribute('aria-hidden', 'true');
        if (!readerOverlayIsOpen()) {
            document.body.style.overflow = '';
        }
        if (lastFocusedElement) lastFocusedElement.focus();
    }

    document.getElementById('detailClose').addEventListener('click', closeBookDetail);
    document.querySelectorAll('[data-close-detail]').forEach((el) => {
        el.addEventListener('click', closeBookDetail);
    });

    /* ============================================================
       Lector de PDF personalizado (pdf.js)
       ============================================================ */
    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const readerOverlay = document.getElementById('pdfReader');
    const readerTitleEl = document.getElementById('readerTitle');
    const readerLoading = document.getElementById('readerLoading');
    const readerLoadingText = readerLoading.querySelector('p');
    const readerDownload = document.getElementById('readerDownload');
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    const pdfFrame = document.getElementById('pdfFrame');
    const pageIndicator = document.getElementById('pageIndicator');
    const zoomLevelEl = document.getElementById('zoomLevel');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    let currentPdf = null;
    let currentPage = 1;
    let totalPages = 1;
    let currentScale = 1.15;
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 2.6;
    let renderTask = null;

    function readerOverlayIsOpen() {
        return readerOverlay.classList.contains('is-open');
    }

    function openReader(file, title) {
        readerTitleEl.textContent = title;
        readerDownload.href = encodeURI(file);
        readerDownload.setAttribute('download', title + '.pdf');

        readerOverlay.classList.add('is-open');
        readerOverlay.classList.remove('is-native');
        readerOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        readerLoading.classList.remove('is-hidden');
        readerLoadingText.textContent = 'Encendiendo la lámpara…';
        canvas.style.display = 'none';
        pdfFrame.style.display = 'none';
        pdfFrame.src = '';
        pageIndicator.textContent = 'Página 1 de 1';

        currentPage = 1;
        currentScale = 1.15;
        updateZoomLabel();

        if (!window.pdfjsLib) {
            showNativeFallback(file);
            return;
        }

        pdfjsLib.getDocument(encodeURI(file)).promise
            .then((pdf) => {
                currentPdf = pdf;
                totalPages = pdf.numPages;
                canvas.style.display = 'block';
                readerLoading.classList.add('is-hidden');
                renderPage(currentPage);
            })
            .catch((err) => {
                // En muchos navegadores, abrir el sitio con doble clic (protocolo
                // file://) bloquea la lectura de archivos locales por seguridad.
                // En ese caso usamos el visor nativo del navegador como respaldo,
                // manteniendo el marco personalizado alrededor.
                console.warn('El lector personalizado no pudo abrir el PDF, usando respaldo nativo:', err);
                showNativeFallback(file);
            });
    }

    function showNativeFallback(file) {
        currentPdf = null;
        readerOverlay.classList.add('is-native');
        readerLoading.classList.add('is-hidden');
        canvas.style.display = 'none';
        pdfFrame.src = encodeURI(file);
        pdfFrame.style.display = 'block';
        pageIndicator.textContent = 'Usa los controles del visor de tu navegador para pasar de página';
    }

    function closeReader() {
        readerOverlay.classList.remove('is-open');
        readerOverlay.classList.remove('is-native');
        readerOverlay.setAttribute('aria-hidden', 'true');
        if (!detailOverlay.classList.contains('is-open')) {
            document.body.style.overflow = '';
        }
        if (renderTask) {
            renderTask.cancel();
            renderTask = null;
        }
        currentPdf = null;
        pdfFrame.src = '';
    }

    function renderPage(num) {
        if (!currentPdf) return;
        canvas.classList.add('is-rendering');

        currentPdf.getPage(num).then((page) => {
            const viewport = page.getViewport({ scale: currentScale * (window.devicePixelRatio || 1) });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = (viewport.width / (window.devicePixelRatio || 1)) + 'px';
            canvas.style.height = (viewport.height / (window.devicePixelRatio || 1)) + 'px';

            if (renderTask) {
                renderTask.cancel();
            }

            renderTask = page.render({ canvasContext: ctx, viewport: viewport });
            renderTask.promise.then(() => {
                canvas.classList.remove('is-rendering');
                renderTask = null;
            }).catch((err) => {
                if (err && err.name !== 'RenderingCancelledException') {
                    console.error('Error al renderizar la página:', err);
                }
            });
        });

        pageIndicator.textContent = `Página ${num} de ${totalPages}`;
        prevBtn.disabled = num <= 1;
        nextBtn.disabled = num >= totalPages;
    }

    function updateZoomLabel() {
        zoomLevelEl.textContent = Math.round((currentScale / 1.15) * 100) + '%';
    }

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage -= 1;
            renderPage(currentPage);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage += 1;
            renderPage(currentPage);
        }
    });

    document.getElementById('zoomIn').addEventListener('click', () => {
        currentScale = Math.min(MAX_SCALE, currentScale + 0.18);
        updateZoomLabel();
        renderPage(currentPage);
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        currentScale = Math.max(MIN_SCALE, currentScale - 0.18);
        updateZoomLabel();
        renderPage(currentPage);
    });

    document.getElementById('readerClose').addEventListener('click', closeReader);

    document.addEventListener('keydown', (e) => {
        if (readerOverlayIsOpen()) {
            if (e.key === 'Escape') closeReader();
            if (e.key === 'ArrowLeft') prevBtn.click();
            if (e.key === 'ArrowRight') nextBtn.click();
        } else if (detailOverlay.classList.contains('is-open')) {
            if (e.key === 'Escape') closeBookDetail();
        }
    });

    /* ============================================================
       Búsqueda
       ============================================================ */
    function searchBooks(query) {
        const term = query.toLowerCase().trim();
        const searchClear = document.getElementById('searchClear');

        searchClear.classList.toggle('is-visible', term.length > 0);

        if (term === '') {
            renderBooks(books);
            return;
        }

        const filtered = books.filter((book) =>
            book.title.toLowerCase().includes(term) ||
            book.author.toLowerCase().includes(term)
        );

        renderBooks(filtered);
    }

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => searchBooks(e.target.value));

    document.getElementById('searchClear').addEventListener('click', () => {
        searchInput.value = '';
        searchBooks('');
        searchInput.focus();
    });

    /* ============================================================
       Inicio
       ============================================================ */
    document.addEventListener('DOMContentLoaded', function () {
        renderBooks(books);
    });
})();
