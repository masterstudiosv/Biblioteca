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
        document.documentElement.style.overflow = 'hidden';

        // Mueve el foco al panel para lectores de pantalla y navegación por teclado
        document.getElementById('detailClose').focus();
    }

    function closeBookDetail() {
        detailOverlay.classList.remove('is-open');
        detailOverlay.setAttribute('aria-hidden', 'true');
        if (!readerOverlayIsOpen()) {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
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
    const readerCanvasWrap = document.querySelector('.reader-canvas-wrap');
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    const pdfFrame = document.getElementById('pdfFrame');
    const pageIndicator = document.getElementById('pageIndicator');
    const zoomLevelEl = document.getElementById('zoomLevel');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const fullscreenBtn = document.getElementById('readerFullscreen');

    let currentPdf = null;
    let currentPage = 1;
    let totalPages = 1;

    // baseScale = el zoom calculado para que la página quepa entera en la
    // pantalla, sin cortes. zoomFactor es lo que el usuario ajusta con +/-,
    // relativo a ese "ajustar a pantalla" (1 = 100% = página completa visible).
    let baseScale = 1;
    let zoomFactor = 1;
    const MIN_ZOOM = 0.4;
    const MAX_ZOOM = 3;
    let renderTask = null;
    let resizeTimeout = null;

    function readerOverlayIsOpen() {
        return readerOverlay.classList.contains('is-open');
    }

    /* ---------- Pantalla completa ---------- */
    const fsSupported = !!(readerOverlay.requestFullscreen || readerOverlay.webkitRequestFullscreen);
    if (fsSupported) {
        readerOverlay.classList.add('fullscreen-supported');
    }

    function isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    function updateFullscreenIcon() {
        if (!fullscreenBtn) return;
        const icon = fullscreenBtn.querySelector('i');
        if (isFullscreen()) {
            icon.className = 'bi bi-fullscreen-exit';
            fullscreenBtn.setAttribute('aria-label', 'Salir de pantalla completa');
        } else {
            icon.className = 'bi bi-arrows-fullscreen';
            fullscreenBtn.setAttribute('aria-label', 'Pantalla completa');
        }
    }

    function toggleFullscreen() {
        if (!isFullscreen()) {
            const req = readerOverlay.requestFullscreen || readerOverlay.webkitRequestFullscreen;
            if (req) req.call(readerOverlay).catch(() => {});
        } else {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) exit.call(document).catch(() => {});
        }
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    ['fullscreenchange', 'webkitfullscreenchange'].forEach((evt) => {
        document.addEventListener(evt, () => {
            updateFullscreenIcon();
            // El área disponible cambia al entrar/salir de pantalla completa,
            // así que recalculamos el ajuste para que la página siga cabiendo entera.
            if (readerOverlayIsOpen() && currentPdf) {
                setTimeout(() => renderPage(currentPage), 120);
            }
        });
    });

    function openReader(file, title) {
        readerTitleEl.textContent = title;
        readerDownload.href = encodeURI(file);
        readerDownload.setAttribute('download', title + '.pdf');

        readerOverlay.classList.add('is-open');
        readerOverlay.classList.remove('is-native');
        readerOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        readerLoading.classList.remove('is-hidden');
        readerLoadingText.textContent = 'Encendiendo la lámpara…';
        canvas.style.display = 'none';
        pdfFrame.style.display = 'none';
        pdfFrame.src = '';
        pageIndicator.textContent = 'Página 1 de 1';

        currentPage = 1;
        zoomFactor = 1;
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
        if (isFullscreen()) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) exit.call(document).catch(() => {});
        }
        readerOverlay.classList.remove('is-open');
        readerOverlay.classList.remove('is-native');
        readerOverlay.setAttribute('aria-hidden', 'true');
        if (!detailOverlay.classList.contains('is-open')) {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }
        if (renderTask) {
            renderTask.cancel();
            renderTask = null;
        }
        currentPdf = null;
        pdfFrame.src = '';
    }

    /* Calcula el zoom necesario para que la página quepa completa,
       sin cortes, dentro del espacio disponible del lector. */
    function computeFitScale(page) {
        const availW = Math.max(readerCanvasWrap.clientWidth - 16, 80);
        const availH = Math.max(readerCanvasWrap.clientHeight - 16, 80);
        const unscaled = page.getViewport({ scale: 1 });
        return Math.min(availW / unscaled.width, availH / unscaled.height);
    }

    function renderPage(num) {
        if (!currentPdf) return;
        canvas.classList.add('is-rendering');

        currentPdf.getPage(num).then((page) => {
            baseScale = computeFitScale(page);
            const effectiveScale = baseScale * zoomFactor;
            const dpr = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale: effectiveScale * dpr });

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = (viewport.width / dpr) + 'px';
            canvas.style.height = (viewport.height / dpr) + 'px';

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
        zoomLevelEl.textContent = Math.round(zoomFactor * 100) + '%';
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
        zoomFactor = Math.min(MAX_ZOOM, +(zoomFactor + 0.15).toFixed(2));
        updateZoomLabel();
        renderPage(currentPage);
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        zoomFactor = Math.max(MIN_ZOOM, +(zoomFactor - 0.15).toFixed(2));
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

    // Al rotar el móvil o cambiar el tamaño de la ventana, recalculamos el
    // ajuste para que la página siga viéndose completa y bien centrada.
    window.addEventListener('resize', () => {
        if (!readerOverlayIsOpen() || !currentPdf) return;
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => renderPage(currentPage), 150);
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
