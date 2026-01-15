function renderBooks(booksToRender) {
            const container = document.getElementById('booksContainer');
            const noResults = document.getElementById('noResults');
            
            container.innerHTML = '';
            
            if (booksToRender.length === 0) {
                noResults.classList.remove('d-none');
                return;
            }
            
            noResults.classList.add('d-none');
            
            booksToRender.forEach(book => {
                const card = document.createElement('div');
                
                const coverHTML = book.cover && book.cover.trim() !== '' 
                    ? `<img src="${book.cover}" alt="${book.title}" class="book-cover-img" onerror="this.parentElement.innerHTML='<div class=book-cover-fallback><i class=\\'bi bi-book fallback-icon\\'></i><div class=fallback-title>${book.title}</div></div>'">`
                    : `<div class="book-cover-fallback">
                           <i class="bi bi-book fallback-icon"></i>
                           <div class="fallback-title">${book.title}</div>
                       </div>`;
                
                card.className = 'book-card';
                card.onclick = () => openPdf(book);
                card.innerHTML = `
                    <div class="book-cover-wrapper">
                        ${coverHTML}
                    </div>
                    <div class="book-info">
                        <h3 class="book-title-text">${book.title}</h3>
                        <div class="book-author-text">${book.author}</div>
                        <div class="book-year-text">${book.year}</div>
                    </div>
                `;
                
                container.appendChild(card);
            });
        }

        function openPdf(book) {
            const modalContent = document.getElementById('bookModalContent');
            
            // Crear contenido del modal con información del libro
            const coverImg = book.cover && book.cover.trim() !== '' 
                ? `<img src="${book.cover}" alt="${book.title}" class="book-cover-large" onerror="this.style.display='none'">`
                : `<div style="width: 100%; max-width: 350px; aspect-ratio: 2/3; background: linear-gradient(135deg, var(--primary-blue), var(--primary-purple)); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem auto;">
                       <i class="bi bi-book" style="font-size: 5rem; color: white;"></i>
                   </div>`;
            
            modalContent.innerHTML = `
                ${coverImg}
                <div class="book-details">
                    <h2>${book.title}</h2>
                    
                    <div class="detail-item">
                        <div class="detail-label">Autor</div>
                        <div class="detail-value">${book.author}</div>
                    </div>
                    
                    <div class="detail-item">
                        <div class="detail-label">Año</div>
                        <div class="detail-value">${book.year}</div>
                    </div>
                    
                    <div class="book-description-modal">
                        ${book.description}
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn-modal-action btn-view-book" onclick="viewPdf('${book.file}', '${book.title}')">
                            <i class="bi bi-book-half"></i>
                            <span>Ver Libro</span>
                        </button>
                        <a href="${book.file}" class="btn-modal-action btn-download-book" download="${book.title}.pdf">
                            <i class="bi bi-download"></i>
                            <span>Descargar</span>
                        </a>
                    </div>
                </div>
            `;
            
            const modal = new bootstrap.Modal(document.getElementById('bookInfoModal'));
            modal.show();
        }

        function viewPdf(file, title) {
            // Cerrar modal de información
            const infoModal = bootstrap.Modal.getInstance(document.getElementById('bookInfoModal'));
            if (infoModal) {
                infoModal.hide();
            }
            
            // Abrir modal de PDF en pantalla completa
            const pdfViewer = document.getElementById('pdfViewer');
            const pdfModalLabel = document.getElementById('pdfModalLabel');
            
            pdfViewer.src = file;
            pdfModalLabel.textContent = title;
            
            const pdfModal = new bootstrap.Modal(document.getElementById('pdfModal'));
            pdfModal.show();
        }

        function searchBooks(query) {
            const searchTerm = query.toLowerCase().trim();
            
            if (searchTerm === '') {
                renderBooks(books);
                return;
            }
            
            const filteredBooks = books.filter(book => {
                return book.title.toLowerCase().includes(searchTerm) || 
                       book.author.toLowerCase().includes(searchTerm);
            });
            
            renderBooks(filteredBooks);
        }

        document.getElementById('searchInput').addEventListener('input', function(e) {
            searchBooks(e.target.value);
        });

        document.querySelector('.search-btn').addEventListener('click', function() {
            searchBooks(document.getElementById('searchInput').value);
        });

        document.getElementById('pdfModal').addEventListener('hidden.bs.modal', function() {
            document.getElementById('pdfViewer').src = '';
        });

        document.getElementById('bookInfoModal').addEventListener('hidden.bs.modal', function() {
            document.getElementById('bookModalContent').innerHTML = '';
        });

        document.addEventListener('DOMContentLoaded', function() {
            renderBooks(books);
        });
