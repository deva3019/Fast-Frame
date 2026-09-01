/**
 * FastFrame Gallery Engine - V2 Performance Edition
 * Optimized for 5000+ DOM Nodes via Event Delegation, 
 * DocumentFragments, and Content-Visibility culling.
 */

const FF_App = (() => {
    
    const State = {
        clientId: window.FF_CLIENT_ID,
        currentEventId: null,
        currentFolderId: null,
        currentEventName: null,
        nextPageToken: null,
        isLoading: false,
        selections: {},
        loadedImages: [], 
        globalImageMap: new Map(),
        lightboxIndex: 0,
        saveTimeout: null,
        abortController: null
    };

    const DOM = {
        grid: document.getElementById('gallery-grid'),
        tabsContainer: document.getElementById('event-tabs-container'),
        loadingSentinel: document.getElementById('loading-sentinel'),
        saveStatus: document.getElementById('global-save-status'),
        saveText: document.getElementById('global-save-text'),
        navTotal: document.getElementById('nav-total-count'),
        galleryView: document.getElementById('gallery-view'),
        reviewView: document.getElementById('review-view'),
        reviewBtn: document.getElementById('nav-review-btn'),
        reviewContent: document.getElementById('review-content'),
        lightbox: {
            overlay: document.getElementById('lightbox'),
            img: document.getElementById('lightbox-img'),
            title: document.getElementById('lightbox-filename'),
            folder: document.getElementById('lightbox-folder-name'),
            counter: document.getElementById('lightbox-counter'),
            selectBtn: document.getElementById('lightbox-select-btn'),
            selectText: document.getElementById('lightbox-select-text'),
            touchArea: document.getElementById('lightbox-touch-area')
        }
    };

    const Toast = {
        show: (message, type = 'info') => {
            const container = document.getElementById('toast-container');
            if(!container) return;
            const toast = document.createElement('div');
            const bgClass = type === 'error' ? 'bg-red-600' : 'bg-mono-black dark:bg-mono-white';
            const textClass = type === 'error' ? 'text-white' : 'text-mono-white dark:text-mono-black';
            toast.className = `toast-enter flex items-center gap-3 px-6 py-3 shadow-2xl ${bgClass} ${textClass}`;
            toast.innerHTML = `<span class="text-[10px] font-bold tracking-widest uppercase">${message}</span>`;
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, 20px)';
                toast.style.transition = 'all 0.4s ease-in';
                setTimeout(() => toast.remove(), 400);
            }, 3000);
        }
    };

    const Theme = {
        init: () => {
            const isDark = localStorage.getItem('ff-theme') === 'dark' || 
                          (!('ff-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.classList.toggle('dark', isDark);
        },
        toggle: () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('ff-theme', isDark ? 'dark' : 'light');
        }
    };

    const Gallery = {
        init: async () => {
            Theme.init();
            await Gallery.fetchInitialSelections();
            
            // ⚡ OPTIMIZATION: Event Delegation on the Grid
            // Replaces thousands of individual event listeners
            DOM.grid.addEventListener('click', (e) => {
                const selectBtn = e.target.closest('.select-btn');
                const imgNode = e.target.closest('.gallery-img');
                
                if (selectBtn) {
                    Selections.toggle(selectBtn.dataset.id);
                } else if (imgNode) {
                    Lightbox.open(parseInt(imgNode.dataset.index, 10));
                }
            });

            const firstTab = document.querySelector('.event-tab');
            if (firstTab) firstTab.click();

            ScrollObserver.init();
            Lightbox.initTouch();
            Keyboard.init();
        },

        fetchInitialSelections: async () => {
            try {
                const res = await fetch(`/api/selections/all/${State.clientId}`);
                if (res.ok) {
                    const data = await res.json();
                    document.querySelectorAll('.event-tab').forEach(tab => {
                        const evtId = tab.dataset.eventId;
                        State.selections[evtId] = new Set(data.selections[evtId] || []);
                    });
                    Counters.updateAll();
                }
            } catch (err) { Toast.show("Failed to load selections", "error"); }
        },

        loadEvent: (eventId, folderId, tabEl, eventName) => {
            if (State.currentEventId === eventId && !DOM.galleryView.classList.contains('hidden')) return;
            if (State.abortController) State.abortController.abort();
            
            document.querySelectorAll('.event-tab').forEach(el => {
                el.classList.remove('text-mono-black', 'dark:text-mono-white');
                el.classList.add('text-mono-500');
                el.querySelector('.tab-indicator').classList.replace('scale-x-100', 'scale-x-0');
            });
            tabEl.classList.remove('text-mono-500');
            tabEl.classList.add('text-mono-black', 'dark:text-mono-white');
            tabEl.querySelector('.tab-indicator').classList.replace('scale-x-0', 'scale-x-100');

            if(DOM.reviewView) Review.close();
            DOM.grid.innerHTML = '';
            State.currentEventId = eventId;
            State.currentFolderId = folderId;
            State.currentEventName = eventName;
            State.nextPageToken = null;
            State.loadedImages = [];
            State.isLoading = false;

            if (!State.selections[eventId]) State.selections[eventId] = new Set();
            Gallery.fetchImages();
            tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        },

        fetchImages: async () => {
            if (State.isLoading) return;
            State.isLoading = true;
            DOM.loadingSentinel.classList.remove('hidden');

            State.abortController = new AbortController();
            const url = `/api/images/${State.currentFolderId}${State.nextPageToken ? `?pageToken=${State.nextPageToken}` : ''}`;

            try {
                const response = await fetch(url, { signal: State.abortController.signal });
                const data = await response.json();
                
                if(!data.images) throw new Error("Failed to load");

                data.images.forEach(img => State.globalImageMap.set(img.id, img));
                State.nextPageToken = data.next_page_token;
                
                Gallery.renderMasonryBatch(data.images);

                if (State.nextPageToken) ScrollObserver.observe();
                else {
                    ScrollObserver.disconnect();
                    DOM.loadingSentinel.classList.add('hidden');
                }
            } catch (error) {
                if (error.name !== 'AbortError') DOM.loadingSentinel.innerHTML = `<p class="text-xs text-red-500 font-mono uppercase">Connection Error</p>`;
            } finally {
                State.isLoading = false;
            }
        },

        renderMasonryBatch: (images) => {
            // ⚡ OPTIMIZATION: DocumentFragment batches DOM updates to prevent layout thrashing
            const fragment = document.createDocumentFragment();
            const startIndex = State.loadedImages.length;

            images.forEach((img, i) => {
                const globalIndex = startIndex + i;
                State.loadedImages.push(img);
                
                const isSelected = State.selections[State.currentEventId].has(img.id);
                const card = document.createElement('div');
                
                // ⚡ OPTIMIZATION: content-visibility: auto tells the GPU to ignore this div if it is off-screen
                card.className = `masonry-item relative group aspect-[4/5] bg-mono-100 dark:bg-mono-900 overflow-hidden cursor-pointer file-${img.id}`;
                card.style.contentVisibility = 'auto'; 
                card.style.containIntrinsicSize = '400px 500px';

                const selClass = isSelected 
                    ? 'bg-mono-black text-mono-white dark:bg-mono-white dark:text-mono-black border-transparent' 
                    : 'bg-mono-black/20 text-transparent border-mono-white/50 hover:border-mono-white';

                card.innerHTML = `
                    <img src="${img.thumbnail}" alt="Archive ${globalIndex}" loading="lazy" data-index="${globalIndex}"
                         class="gallery-img w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105">
                    <div class="absolute top-4 right-4 z-10">
                        <button data-id="${img.id}" class="select-btn w-8 h-8 flex items-center justify-center border transition-all duration-300 ${selClass}">
                            <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        </button>
                    </div>
                `;
                fragment.appendChild(card);
                
                // Keep the smooth fade-in
                setTimeout(() => { card.classList.add('loaded'); }, i * 20);
            });
            
            DOM.grid.appendChild(fragment);
        }
    };

    const ScrollObserver = {
        observer: null,
        init: () => {
            ScrollObserver.observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && State.nextPageToken && !State.isLoading) {
                    Gallery.fetchImages();
                }
            }, { rootMargin: '800px' }); // Load sooner to mask latency
        },
        observe: () => ScrollObserver.observer.observe(DOM.loadingSentinel),
        disconnect: () => ScrollObserver.observer.disconnect()
    };

    const Selections = {
        toggle: (fileId, evtId = null) => {
            const eventId = evtId || State.currentEventId;
            const targetSet = State.selections[eventId];

            if (targetSet.has(fileId)) targetSet.delete(fileId);
            else targetSet.add(fileId);

            const btn = document.querySelector(`.file-${fileId} .select-btn`);
            if (btn) {
                const isSelected = targetSet.has(fileId);
                btn.className = `select-btn w-8 h-8 flex items-center justify-center border transition-all duration-300 ${
                    isSelected ? 'bg-mono-black text-mono-white dark:bg-mono-white dark:text-mono-black border-transparent' 
                               : 'bg-mono-black/20 text-transparent border-mono-white/50 hover:border-mono-white'
                }`;
            }

            Counters.updateAll();
            Selections.autoSave(eventId);
        },

        autoSave: (eventId) => {
            DOM.saveStatus.classList.remove('opacity-0');
            DOM.saveText.innerText = "Syncing...";
            DOM.saveStatus.querySelector('div').classList.remove('bg-red-500');
            DOM.saveStatus.querySelector('div').classList.add('bg-green-500', 'animate-pulse');

            clearTimeout(State.saveTimeout);
            State.saveTimeout = setTimeout(async () => {
                try {
                    const res = await fetch('/api/selections/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            special_id: State.clientId,
                            event_id: eventId,
                            selected_ids: Array.from(State.selections[eventId])
                        })
                    });
                    
                    if (res.ok) {
                        DOM.saveText.innerText = "Saved";
                        DOM.saveStatus.querySelector('div').classList.remove('animate-pulse');
                        setTimeout(() => DOM.saveStatus.classList.add('opacity-0'), 2000);
                    } else throw new Error();
                } catch (err) {
                    DOM.saveText.innerText = "Sync Failed";
                    DOM.saveStatus.querySelector('div').classList.replace('bg-green-500', 'bg-red-500');
                }
            }, 1200); // Increased debounce time for aggressive selecting
        }
    };

    const Counters = {
        updateAll: () => {
            let grandTotal = 0;
            for (const [evtId, set] of Object.entries(State.selections)) {
                const count = set.size;
                grandTotal += count;
                const badge = document.querySelector(`.tab-count[data-count-for="${evtId}"]`);
                if (badge) {
                    badge.innerText = count;
                    badge.classList.toggle('hidden', count === 0);
                }
            }
            DOM.navTotal.innerText = grandTotal;
            if(grandTotal > 0) {
                DOM.navTotal.classList.remove('bg-mono-800', 'dark:bg-mono-200');
                DOM.navTotal.classList.add('bg-green-500', 'text-white');
            } else {
                DOM.navTotal.classList.remove('bg-green-500', 'text-white');
                DOM.navTotal.classList.add('bg-mono-800', 'dark:bg-mono-200');
            }
            const reviewDisplay = document.getElementById('review-count-display');
            if(reviewDisplay) reviewDisplay.innerText = grandTotal;
        }
    };

    const Lightbox = {
        open: (index) => {
            State.lightboxIndex = index;
            const imgData = State.loadedImages[index];
            
            DOM.lightbox.img.src = imgData.thumbnail; 
            const hdImage = new Image();
            hdImage.src = imgData.full; 
            hdImage.onload = () => { if(State.lightboxIndex === index) DOM.lightbox.img.src = imgData.full; };

            DOM.lightbox.counter.innerText = `${index + 1} / ${State.loadedImages.length}`;
            DOM.lightbox.title.innerText = imgData.name;
            DOM.lightbox.folder.innerText = State.currentEventName;
            
            Lightbox.syncBtn(imgData.id);

            DOM.lightbox.overlay.classList.remove('hidden');
            DOM.lightbox.overlay.classList.add('flex');
            setTimeout(() => DOM.lightbox.overlay.classList.remove('opacity-0'), 10);
            document.body.style.overflow = 'hidden';
        },

        close: () => {
            DOM.lightbox.overlay.classList.add('opacity-0');
            setTimeout(() => {
                DOM.lightbox.overlay.classList.add('hidden');
                DOM.lightbox.overlay.classList.remove('flex');
            }, 500);
            document.body.style.overflow = '';
            DOM.lightbox.img.classList.remove('zoom-active');
        },

        next: () => {
            if (State.lightboxIndex < State.loadedImages.length - 1) {
                DOM.lightbox.img.classList.remove('zoom-active');
                Lightbox.open(State.lightboxIndex + 1);
            }
        },

        prev: () => {
            if (State.lightboxIndex > 0) {
                DOM.lightbox.img.classList.remove('zoom-active');
                Lightbox.open(State.lightboxIndex - 1);
            }
        },

        toggleZoom: () => DOM.lightbox.img.classList.toggle('zoom-active'),
        
        toggleSelection: () => {
            const id = State.loadedImages[State.lightboxIndex].id;
            Selections.toggle(id);
            Lightbox.syncBtn(id);
        },

        syncBtn: (fileId) => {
            const isSel = State.selections[State.currentEventId].has(fileId);
            if (isSel) {
                DOM.lightbox.selectBtn.classList.add('bg-mono-black', 'text-mono-white', 'dark:bg-mono-white', 'dark:text-mono-black', 'border-transparent');
                DOM.lightbox.selectBtn.classList.remove('text-mono-500');
                DOM.lightbox.selectText.innerText = "Selected";
            } else {
                DOM.lightbox.selectBtn.classList.remove('bg-mono-black', 'text-mono-white', 'dark:bg-mono-white', 'dark:text-mono-black', 'border-transparent');
                DOM.lightbox.selectBtn.classList.add('text-mono-500');
                DOM.lightbox.selectText.innerText = "Select";
            }
        },

        initTouch: () => {
            let touchStartX = 0;
            let touchEndX = 0;
            DOM.lightbox.touchArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
            DOM.lightbox.touchArea.addEventListener('touchend', e => {
                touchEndX = e.changedTouches[0].screenX;
                if (touchStartX - touchEndX > 50) Lightbox.next();
                if (touchEndX - touchStartX > 50) Lightbox.prev();
            }, {passive: true});
        }
    };

    const Review = {
        open: async () => {
            let total = 0;
            Object.values(State.selections).forEach(s => total += s.size);
            
            if (total === 0) return Toast.show("Select images before reviewing.", "error");

            DOM.galleryView.classList.add('hidden');
            DOM.reviewBtn.classList.add('hidden');
            DOM.reviewView.classList.remove('hidden');
            window.scrollTo(0,0);
            
            DOM.reviewContent.innerHTML = `<div class="w-full py-32 text-center animate-pulse"><p class="text-xs font-mono uppercase tracking-widest text-mono-500">Compiling Archives...</p></div>`;

            let requiresFetch = false;
            for (const set of Object.values(State.selections)) {
                for (const id of set) {
                    if (!State.globalImageMap.has(id)) { requiresFetch = true; break; }
                }
            }

            let eventsData = [];
            try {
                if (!requiresFetch) {
                    for (const [evtId, set] of Object.entries(State.selections)) {
                        if (set.size === 0) continue;
                        const tab = document.querySelector(`.event-tab[data-event-id="${evtId}"]`);
                        const name = tab ? tab.childNodes[0].nodeValue.trim() : "Collection";
                        eventsData.push({ 
                            event_id: evtId, 
                            event_name: name, 
                            images: Array.from(set).map(id => State.globalImageMap.get(id))
                        });
                    }
                } else {
                    const res = await fetch(`/api/selections/details/${State.clientId}`);
                    const data = await res.json();
                    eventsData = data.events;
                }
                Review.render(eventsData);
            } catch (e) {
                DOM.reviewContent.innerHTML = `<p class="text-red-500 text-xs font-mono uppercase text-center">Data retrieval failed.</p>`;
            }
        },

        render: (eventsData) => {
            DOM.reviewContent.innerHTML = '';
            eventsData.forEach(event => {
                if (!event.images || event.images.length === 0) return;
                
                event.images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                
                const section = document.createElement('div');
                section.className = "mb-16";
                
                const gridHtml = event.images.map(img => `
                    <div class="relative aspect-[4/5] bg-mono-100 dark:bg-mono-900 group mb-6 rev-card-${img.id} overflow-hidden">
                        <img src="${img.thumbnail}" class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-mono-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <button onclick="FF_App.Review.remove('${img.id}', '${event.event_id}')" class="bg-red-600 text-white text-[9px] font-bold tracking-widest-xl uppercase px-8 py-4 hover:scale-95 transition-transform">Remove</button>
                        </div>
                    </div>
                `).join('');

                section.innerHTML = `
                    <div class="flex items-center justify-between border-b border-mono-200 dark:border-mono-800 pb-4 mb-8">
                        <h3 class="text-sm font-display font-bold uppercase tracking-widest">${event.event_name}</h3>
                        <span class="text-[10px] font-mono text-mono-500">${event.images.length} files</span>
                    </div>
                    <div class="masonry-grid">${gridHtml}</div>
                `;
                DOM.reviewContent.appendChild(section);
            });
        },

        remove: (fileId, evtId) => {
            Selections.toggle(fileId, evtId);
            const card = document.querySelector(`.rev-card-${fileId}`);
            if (card) card.remove();
            
            let total = 0;
            Object.values(State.selections).forEach(s => total += s.size);
            if (total === 0) Review.close();
        },

        close: () => {
            DOM.reviewView.classList.add('hidden');
            DOM.galleryView.classList.remove('hidden');
            DOM.reviewBtn.classList.remove('hidden');
        },

        submit: async () => {
            if(!confirm("Finalize and send these selections to the studio?")) return;
            
            const btn = document.getElementById('final-submit-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = `<span class="relative z-10 text-xs font-bold tracking-widest-xl uppercase">Transmitting...</span>`;
            btn.disabled = true;

            try {
                const res = await fetch('/api/selections/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ special_id: State.clientId })
                });
                
                if (res.ok) {
                    btn.innerHTML = `<span class="relative z-10 text-xs font-bold tracking-widest-xl uppercase text-green-500">Submission Confirmed</span>`;
                    setTimeout(() => window.location.href = "/", 2000);
                } else throw new Error();
            } catch (e) {
                btn.innerHTML = originalText;
                btn.disabled = false;
                Toast.show("Transmission Failed. Retry.", "error");
            }
        }
    };

    const Keyboard = {
        init: () => {
            document.addEventListener('keydown', (e) => {
                if (!DOM.lightbox.overlay.classList.contains('hidden')) {
                    if (e.key === 'Escape') Lightbox.close();
                    if (e.key === 'ArrowRight') Lightbox.next();
                    if (e.key === 'ArrowLeft') Lightbox.prev();
                }
            });
        }
    };

    return { init: Gallery.init, Theme, Gallery, Selections, Lightbox, Review };
})();

document.addEventListener('DOMContentLoaded', FF_App.init);