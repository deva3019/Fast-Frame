/**
 * FastFrame Admin Dashboard Engine
 * Architecture: Revealing Module Pattern
 * Modules: UI, Theme, Parallax, Dashboard, Clients, Galleries, Settings
 */

const FF_Admin = (() => {

    // Shared State
    let syncTargetClientId = null;

    // ==========================================
    // 1. UI & MICRO-INTERACTIONS
    // ==========================================
    const UI = {
        showToast: (message, type = 'info') => {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const toast = document.createElement('div');
            const bgClass = type === 'error' ? 'bg-red-600 text-white' : 'bg-mono-white text-mono-black dark:bg-mono-black dark:text-mono-white border border-mono-300 dark:border-mono-700';
            
            toast.className = `flex items-center gap-3 px-6 py-3 shadow-2xl rounded-lg ${bgClass} opacity-0 transform translate-y-4 transition-all duration-300`;
            toast.innerHTML = `<span class="text-[10px] font-bold tracking-widest uppercase">${message}</span>`;
            
            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.remove('opacity-0', 'translate-y-4'));
            
            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-4');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },
        
        toggleMobileMenu: () => {
            const line1 = document.getElementById('line-1');
            const line2 = document.getElementById('line-2');
            const sidebar = document.getElementById('main-sidebar');
            if(!sidebar) return;
            
            if (sidebar.classList.contains('hidden')) {
                sidebar.classList.remove('hidden');
                sidebar.classList.add('absolute', 'w-full', 'z-50', 'bg-mono-100/95', 'dark:bg-mono-900/95', 'backdrop-blur-2xl');
                line1.style.transform = 'translateY(4px) rotate(45deg)';
                line2.style.transform = 'translateY(-4px) rotate(-45deg)';
                line2.style.width = '1.5rem';
            } else {
                sidebar.classList.add('hidden');
                sidebar.classList.remove('absolute', 'w-full', 'z-50', 'bg-mono-100/95', 'dark:bg-mono-900/95', 'backdrop-blur-2xl');
                line1.style.transform = 'none';
                line2.style.transform = 'none';
                line2.style.width = '1rem';
            }
        },

        toggleInfoModal: () => {
            const modal = document.getElementById('info-modal');
            const content = document.getElementById('info-modal-content');
            if(!modal || !content) return;
            
            if (modal.classList.contains('hidden')) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    content.classList.remove('scale-95', 'opacity-0');
                    content.classList.add('scale-100', 'opacity-100');
                }, 10);
            } else {
                content.classList.remove('scale-100', 'opacity-100');
                content.classList.add('scale-95', 'opacity-0');
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
        }
    };

    // ==========================================
    // 2. THEME & AUTHENTICATION
    // ==========================================
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

    const Auth = {
        logout: async () => {
            await fetch('/auth/logout');
            window.location.href = '/auth/login';
        }
    };

    // ==========================================
    // 3. HARDWARE ACCELERATION (3D Parallax)
    // ==========================================
    const ParallaxCards = {
        init: () => {
            const cards = document.querySelectorAll('.tilt-card');
            cards.forEach(card => {
                const glare = card.querySelector('.tilt-glare');
                
                card.addEventListener('mousemove', (e) => {
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    const xPct = (x / rect.width - 0.5) * 2;
                    const yPct = (y / rect.height - 0.5) * 2;
                    
                    card.style.transform = `perspective(1000px) rotateX(${yPct * -8}deg) rotateY(${xPct * 8}deg) scale3d(1.02, 1.02, 1.02)`;
                    
                    if (glare) glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.1) 0%, transparent 60%)`;
                });

                card.addEventListener('mouseleave', () => {
                    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
                    if (glare) glare.style.background = `transparent`;
                });
            });
        }
    };

    // ==========================================
    // 4. DASHBOARD (Async Hydration)
    // ==========================================
    const Dashboard = {
        init: async () => {
            if (!document.getElementById('stat-clients')) return;

            try {
                const res = await fetch('/api/admin/stats');
                const data = await res.json();
                
                if (data.success) {
                    document.getElementById('stat-clients').innerText = data.total_clients;
                    document.getElementById('stat-galleries').innerText = data.total_events;
                    document.getElementById('stat-selections').innerText = data.total_selected_images;

                    ['clients', 'galleries', 'selections'].forEach(type => {
                        const skel = document.getElementById(`skel-${type}`);
                        const stat = document.getElementById(`stat-${type}`);
                        if(skel && stat) {
                            skel.classList.add('hidden');
                            stat.classList.remove('hidden');
                            stat.classList.add('animate-fade-in');
                        }
                    });
                }
            } catch (err) {
                console.error("Dashboard Load Error");
                ['clients', 'galleries', 'selections'].forEach(type => {
                    const skel = document.getElementById(`skel-${type}`);
                    const stat = document.getElementById(`stat-${type}`);
                    if(skel && stat) {
                        skel.classList.add('hidden');
                        stat.innerText = "ERR";
                        stat.classList.remove('hidden');
                    }
                });
            }
        }
    };

    // ==========================================
    // 5. CLIENT VAULT MANAGEMENT
    // ==========================================
    const Clients = {
        data: [], // Local cache for instant search

        init: () => {
            const form = document.getElementById('add-client-form');
            if (form) {
                Clients.fetchList();
                form.addEventListener('submit', Clients.add);
                
                document.getElementById('search-clients')?.addEventListener('input', Clients.renderList);
                document.getElementById('filter-status')?.addEventListener('change', Clients.renderList);
            }
        },

        formatDate: (isoString) => {
            if (!isoString) return "N/A";
            const safeIso = isoString.endsWith('Z') || isoString.includes('+') ? isoString : isoString + 'Z';
            const date = new Date(safeIso);
            
            return new Intl.DateTimeFormat('en-IN', { 
                timeZone: 'Asia/Kolkata',
                month: 'short', day: 'numeric', year: 'numeric', 
                hour: 'numeric', minute: '2-digit', hour12: true 
            }).format(date);
        },

        fetchList: async () => {
            const listEl = document.getElementById('clients-list');
            const skelEl = document.getElementById('clients-skeleton');
            if(!listEl || !skelEl) return;

            listEl.classList.add('hidden');
            skelEl.classList.remove('hidden');

            try {
                const res = await fetch('/api/admin/clients');
                const data = await res.json();
                
                if (data.success) {
                    Clients.data = data.clients;
                    Clients.renderList(); 
                    
                    skelEl.classList.add('hidden');
                    listEl.classList.remove('hidden');
                    listEl.classList.add('animate-fade-in');
                }
            } catch (err) {
                skelEl.classList.add('hidden');
                listEl.classList.remove('hidden');
                listEl.innerHTML = `<div class="p-8 text-center text-red-500 text-xs font-mono uppercase tracking-widest glass-panel rounded-2xl">Network Error. Check console.</div>`;
            }
        },

        renderList: () => {
            const listEl = document.getElementById('clients-list');
            const searchQuery = document.getElementById('search-clients')?.value.toLowerCase() || '';
            const statusFilter = document.getElementById('filter-status')?.value || 'ALL';

            const filtered = Clients.data.filter(c => {
                const matchesSearch = c.client_name.toLowerCase().includes(searchQuery) || 
                                      c.special_id.toLowerCase().includes(searchQuery) || 
                                      (c.phone && c.phone.includes(searchQuery));
                const matchesStatus = statusFilter === 'ALL' || c.selection_status === statusFilter;
                return matchesSearch && matchesStatus;
            });

            if (filtered.length === 0) {
                listEl.innerHTML = `<div class="p-16 text-center text-mono-500 text-[10px] font-bold tracking-[0.2em] uppercase border border-dashed border-mono-300 dark:border-mono-700 rounded-3xl glass-panel">No matching records found.</div>`;
                return;
            }

            listEl.innerHTML = filtered.map(client => `
                <div class="glass-panel rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-mono-black dark:hover:border-mono-white transition-all hover:-translate-y-1 shadow-sm hover:shadow-lg group">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <h4 class="font-display font-bold text-2xl">${client.client_name}</h4>
                            <span class="text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-full ${client.selection_status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-mono-200 text-mono-600 dark:bg-mono-800 dark:text-mono-400'}">
                                ${client.selection_status}
                            </span>
                        </div>
                        
                        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-mono tracking-widest uppercase text-mono-500">
                            <span class="flex items-center gap-1.5"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg> ${client.special_id}</span>
                            ${client.phone ? `<span class="flex items-center gap-1.5"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg> ${client.phone}</span>` : ''}
                            <span class="flex items-center gap-1.5"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ${Clients.formatDate(client.created_at)}</span>
                        </div>
                    </div>
                    
                    <button onclick="FF_Admin.Clients.delete('${client.special_id}')" class="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-mono-100 dark:bg-mono-800 text-red-500 hover:bg-red-500 hover:text-white transition-colors" title="Terminate Vault">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            `).join('');
        },

        add: async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            btn.innerHTML = `<span class="animate-pulse">GENERATING...</span>`;
            btn.disabled = true;

            const payload = {
                special_id: document.getElementById('client-id').value,
                client_name: document.getElementById('client-name').value,
                phone: document.getElementById('client-phone').value,
                email: document.getElementById('client-email').value
            };

            try {
                const res = await fetch('/api/admin/clients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    UI.showToast("Vault Generated");
                    e.target.reset();
                    Clients.fetchList();
                } else throw new Error(data.error);
            } catch (err) {
                UI.showToast(err.message, "error");
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        },

        delete: async (id) => {
            if (!confirm(`WARNING: Deleting vault ${id} will sever all mounted drives. Proceed?`)) return;
            try {
                const res = await fetch(`/api/admin/clients/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    UI.showToast("Vault Terminated");
                    Clients.fetchList();
                }
            } catch (err) {
                UI.showToast("Termination failed", "error");
            }
        }
    };

    // ==========================================
    // 6. GALLERY & DRIVE MOUNTS
    // ==========================================
    const Galleries = {
        data: [], // Local cache for instant search

        init: () => {
            const form = document.getElementById('add-gallery-form');
            if (form) {
                Galleries.populateClientDropdown();
                Galleries.fetchList();
                form.addEventListener('submit', Galleries.add);
                
                document.getElementById('search-galleries')?.addEventListener('input', Galleries.renderList);
            }
        },

        toggleMountModal: () => {
            const modal = document.getElementById('mount-modal');
            const content = document.getElementById('mount-modal-content');
            if(!modal || !content) return;
            
            if (modal.classList.contains('hidden')) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    content.classList.remove('scale-95', 'opacity-0');
                    content.classList.add('scale-100', 'opacity-100');
                }, 10);
            } else {
                content.classList.remove('scale-100', 'opacity-100');
                content.classList.add('scale-95', 'opacity-0');
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
        },

        populateClientDropdown: async () => {
            const select = document.getElementById('gallery-client-id');
            if (!select) return;
            try {
                const res = await fetch('/api/admin/clients');
                const data = await res.json();
                if (data.success) {
                    data.clients.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c.special_id;
                        opt.innerText = `${c.client_name} (${c.special_id})`;
                        select.appendChild(opt);
                    });
                }
            } catch (err) { console.error("Dropdown load failed"); }
        },

        fetchList: async () => {
            const listEl = document.getElementById('galleries-list');
            const skelEl = document.getElementById('galleries-skeleton');
            if(!listEl || !skelEl) return;

            listEl.classList.add('hidden');
            skelEl.classList.remove('hidden');

            try {
                const res = await fetch('/api/admin/active-mounts');
                const data = await res.json();
                
                if (data.success) {
                    Galleries.data = data.clients;
                    Galleries.renderList();
                    
                    skelEl.classList.add('hidden');
                    listEl.classList.remove('hidden');
                    listEl.classList.add('animate-fade-in');
                }
            } catch (err) {
                skelEl.classList.add('hidden');
                listEl.classList.remove('hidden');
                listEl.innerHTML = `<div class="col-span-full p-8 text-center text-red-500 text-xs font-mono uppercase tracking-widest glass-panel rounded-2xl">Network Error. Failed to load mounts.</div>`;
            }
        },

        renderList: () => {
            const listEl = document.getElementById('galleries-list');
            const searchQuery = document.getElementById('search-galleries')?.value.toLowerCase() || '';

            const filtered = Galleries.data.filter(c => {
                const matchesClient = c.client_name.toLowerCase().includes(searchQuery) || c.special_id.toLowerCase().includes(searchQuery);
                const matchesEvents = c.events.some(ev => ev.event_name.toLowerCase().includes(searchQuery) || ev.folder_id.toLowerCase().includes(searchQuery));
                return matchesClient || matchesEvents;
            });

            if (filtered.length === 0) {
                listEl.innerHTML = `<div class="col-span-full p-16 text-center text-mono-500 text-[10px] font-bold tracking-[0.2em] uppercase border border-dashed border-mono-300 dark:border-mono-700 rounded-3xl glass-panel">No matching drives found.</div>`;
                return;
            }

            listEl.innerHTML = '';
            filtered.forEach(client => {
                client.events.forEach(ev => {
                    if (searchQuery && !client.client_name.toLowerCase().includes(searchQuery) && !client.special_id.toLowerCase().includes(searchQuery) && !ev.event_name.toLowerCase().includes(searchQuery) && !ev.folder_id.toLowerCase().includes(searchQuery)) {
                        return;
                    }

                    listEl.innerHTML += `
                        <div class="glass-panel rounded-3xl p-8 flex flex-col justify-between hover:shadow-2xl hover:border-mono-black dark:hover:border-mono-white transition-all duration-300 group relative overflow-hidden">
                            <div class="absolute inset-0 bg-gradient-to-br from-mono-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            
                            <div>
                                <div class="flex justify-between items-start mb-6 relative z-10">
                                    <div>
                                        <span class="inline-flex items-center gap-2 text-[8px] font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-mono-200 dark:bg-mono-800 text-mono-600 dark:text-mono-300 mb-3">
                                            <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Linked
                                        </span>
                                        <h4 class="font-display font-bold text-2xl">${ev.event_name}</h4>
                                        <p class="text-[10px] font-mono tracking-widest uppercase text-mono-500 mt-1">${client.client_name} (${client.special_id})</p>
                                    </div>
                                    <button onclick="FF_Admin.Galleries.delete('${client.special_id}', '${ev.event_id}')" class="w-8 h-8 rounded-full bg-mono-100 dark:bg-mono-900 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors" title="Unmount Directory">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                                
                                <div class="p-3 rounded-xl bg-mono-100/50 dark:bg-mono-900/50 border border-mono-200 dark:border-mono-800 mb-6 relative z-10">
                                    <p class="text-[9px] font-bold tracking-widest uppercase text-mono-400 mb-1">Drive Origin ID</p>
                                    <p class="text-xs font-mono text-mono-600 dark:text-mono-300 truncate">${ev.folder_id}</p>
                                </div>
                            </div>

                            <div class="flex items-center gap-3 relative z-10 mt-auto">
                                <button onclick="FF_Admin.Galleries.previewClientView('${client.special_id}')" class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-mono-300 dark:border-mono-700 bg-transparent text-[9px] font-bold tracking-widest uppercase hover:bg-mono-black hover:text-white dark:hover:bg-mono-white dark:hover:text-black transition-colors">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                    Simulate
                                </button>
                                <button onclick="FF_Admin.Galleries.openSyncModal('${client.special_id}')" class="flex-1 py-3 rounded-xl bg-mono-black text-mono-white dark:bg-mono-white dark:text-mono-black text-[9px] font-bold tracking-widest uppercase hover:scale-95 transition-transform shadow-md">
                                    Compile Assets
                                </button>
                            </div>
                        </div>
                    `;
                });
            });
        },

        add: async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            btn.innerHTML = `<span class="animate-pulse">MOUNTING...</span>`;
            btn.disabled = true;

            const payload = {
                special_id: document.getElementById('gallery-client-id').value,
                event_name: document.getElementById('event-name').value,
                drive_url: document.getElementById('drive-url').value
            };

            try {
                const res = await fetch('/api/admin/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    UI.showToast("Drive Mounted");
                    e.target.reset();
                    FF_Admin.Galleries.toggleMountModal();
                    Galleries.fetchList();
                } else throw new Error(data.error);
            } catch (err) {
                UI.showToast(err.message, "error");
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        },

        delete: async (clientId, eventId) => {
            if (!confirm("Unmount this directory?")) return;
            try {
                const res = await fetch(`/api/admin/events/${clientId}/${eventId}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    UI.showToast("Directory Unmounted");
                    Galleries.fetchList();
                }
            } catch (err) { UI.showToast("Unmount failed", "error"); }
        },

        previewClientView: (specialId) => {
            const modal = document.getElementById('preview-modal');
            const container = document.getElementById('preview-container');
            const urlBar = document.getElementById('preview-url-bar');
            const externalLink = document.getElementById('preview-external-link');
            
            if(!modal || !container) return;

            const clientUrl = `/gallery/${specialId}`;
            
            urlBar.innerText = `fastframe.io${clientUrl}`;
            externalLink.href = clientUrl;

            container.innerHTML = `<iframe src="${clientUrl}" class="w-full h-full border-none bg-transparent"></iframe>`;
            modal.classList.remove('hidden');
        },

        closePreview: () => {
            const modal = document.getElementById('preview-modal');
            if(modal) {
                modal.classList.add('hidden');
                document.getElementById('preview-container').innerHTML = '';
            }
        },

        openSyncModal: (clientId) => {
            syncTargetClientId = clientId;
            document.getElementById('sync-client-id').innerText = clientId;
            const modal = document.getElementById('sync-modal');
            if(modal) {
                modal.classList.remove('hidden');
                setTimeout(() => modal.classList.remove('opacity-0'), 10);
            }
        },
        
        closeSyncModal: () => {
            const modal = document.getElementById('sync-modal');
            if(modal) {
                modal.classList.add('opacity-0');
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
            const targetUrl = document.getElementById('sync-target-url');
            if(targetUrl) targetUrl.value = '';
            syncTargetClientId = null;
        },
        
        executeSync: async () => {
            const targetUrl = document.getElementById('sync-target-url').value.trim();
            if(!targetUrl) return UI.showToast("Destination URL required", "error");
            
            const btn = document.getElementById('sync-btn');
            btn.innerHTML = `<span class="animate-pulse">COMPILING ASSETS...</span>`;
            btn.disabled = true;
            
            try {
                const res = await fetch(`/downloads/zip/${syncTargetClientId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target_folder_id: targetUrl })
                });
                const data = await res.json();
                
                if (data.success) {
                    UI.showToast("Asset Compilation Complete");
                    Galleries.closeSyncModal();
                    window.open(data.link, '_blank'); 
                } else throw new Error(data.error);
            } catch (err) {
                UI.showToast(err.message, "error");
            } finally {
                btn.innerHTML = "Execute Sync";
                btn.disabled = false;
            }
        }
    };

    // ==========================================
    // 7. SYSTEM SETTINGS
    // ==========================================
    const Settings = {
        isEditingMode: false,
        guideStep: 0,
        redactedPreviewData: "",

        init: () => {
            const profileForm = document.getElementById('profile-form');
            if (profileForm) {
                Settings.loadProfile();
                Settings.loadCredentials();
                profileForm.addEventListener('submit', Settings.updateProfile);
                Settings.initDropzone();
            }
        },

        toggleEditMode: () => {
            Settings.isEditingMode = !Settings.isEditingMode;
            const btn = document.getElementById('profile-edit-btn');
            const saveBtn = document.getElementById('profile-save-btn');
            
            const displays = ['display-name', 'display-email', 'display-tagline'];
            const inputs = ['profile-name', 'profile-email', 'profile-tagline'];

            displays.forEach(id => document.getElementById(id).classList.toggle('hidden', Settings.isEditingMode));
            inputs.forEach(id => document.getElementById(id).classList.toggle('hidden', !Settings.isEditingMode));
            
            btn.innerText = Settings.isEditingMode ? "Cancel" : "Edit Identity";
            saveBtn.classList.toggle('hidden', !Settings.isEditingMode);
        },

        loadProfile: async () => {
            try {
                const res = await fetch('/settings/api/profile');
                const data = await res.json();
                if (data.success && data.profile) {
                    const name = data.profile.studio_name || 'FastFrame Studio';
                    
                    document.getElementById('display-name').innerText = name;
                    document.getElementById('display-email').innerText = data.profile.contact_email || 'No email set';
                    document.getElementById('display-tagline').innerText = data.profile.tagline || 'No tagline set';
                    
                    document.getElementById('profile-name').value = name;
                    document.getElementById('profile-email').value = data.profile.contact_email || '';
                    document.getElementById('profile-tagline').value = data.profile.tagline || '';
                    
                    document.getElementById('avatar-initials').innerText = name.substring(0, 2).toUpperCase();
                }
            } catch (err) { console.error("Profile load failed"); }
        },

        updateProfile: async (e) => {
            e.preventDefault();
            const btn = document.getElementById('profile-save-btn');
            btn.innerHTML = `<span class="animate-pulse">SAVING...</span>`;
            btn.disabled = true;

            const payload = {
                studio_name: document.getElementById('profile-name').value,
                contact_email: document.getElementById('profile-email').value,
                tagline: document.getElementById('profile-tagline').value
            };

            try {
                const res = await fetch('/settings/api/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    UI.showToast("Identity Updated");
                    Settings.loadProfile();
                    Settings.toggleEditMode();
                } else throw new Error(data.error);
            } catch (err) {
                UI.showToast(err.message, "error");
            } finally {
                btn.innerText = "Save Changes";
                btn.disabled = false;
            }
        },

        loadCredentials: async () => {
            try {
                const res = await fetch('/settings/api/credentials');
                const data = await res.json();
                
                if (data.success && data.has_credentials) {
                    document.getElementById('view-keys-btn').classList.remove('hidden');
                    document.getElementById('service-account-banner').classList.remove('hidden');
                    document.getElementById('service-email-text').innerText = data.client_email;
                    Settings.redactedPreviewData = data.preview;
                }
            } catch (err) { console.error("Credentials load failed"); }
        },

        copyEmail: () => {
            const email = document.getElementById('service-email-text').innerText;
            navigator.clipboard.writeText(email).then(() => {
                UI.showToast("Email Copied to Clipboard");
            }).catch(() => UI.showToast("Failed to copy", "error"));
        },

        initDropzone: () => {
            const dropzone = document.getElementById('dropzone');
            const fileInput = document.getElementById('file-upload');
            if(!dropzone || !fileInput) return;

            dropzone.addEventListener('click', () => fileInput.click());

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('border-blue-500', 'bg-blue-500/10');
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('border-blue-500', 'bg-blue-500/10');
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('border-blue-500', 'bg-blue-500/10');
                if (e.dataTransfer.files.length) {
                    Settings.processJSONFile(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) {
                    Settings.processJSONFile(e.target.files[0]);
                }
            });
        },

        processJSONFile: (file) => {
            if (file.type !== "application/json" && !file.name.endsWith('.json')) {
                return UI.showToast("Only .json files are accepted", "error");
            }

            const icon = document.getElementById('dropzone-icon');
            const title = document.getElementById('dropzone-title');
            
            icon.classList.add('animate-pulse', 'text-blue-500');
            title.innerText = "Parsing Encryption...";

            const reader = new FileReader();
            reader.onload = async (e) => {
                const rawJson = e.target.result;
                try {
                    JSON.parse(rawJson);
                    
                    const res = await fetch('/api/credentials', { // Ensuring correct API path
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ credentials_json: rawJson })
                    });
                    const data = await res.json();

                    if (data.success) {
                        UI.showToast("Keys Encrypted & Secured");
                        Settings.loadCredentials();
                        title.innerText = "Vault Updated Successfully";
                        icon.innerHTML = `<svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
                    } else throw new Error(data.error);

                } catch (err) {
                    UI.showToast(err.message, "error");
                    title.innerText = "Upload credentials.json";
                } finally {
                    icon.classList.remove('animate-pulse', 'text-blue-500');
                }
            };
            reader.readAsText(file);
        },
        previewCredentials: () => Settings.togglePreviewModal(),

        togglePreviewModal: () => {
            const modal = document.getElementById('preview-modal');
            const content = document.getElementById('preview-modal-content');
            if(!modal) return;
            
            if (modal.classList.contains('hidden')) {
                document.getElementById('json-preview-text').innerText = Settings.redactedPreviewData;
                modal.classList.remove('hidden');
                setTimeout(() => {
                    content.classList.remove('scale-95', 'opacity-0');
                    content.classList.add('scale-100', 'opacity-100');
                }, 10);
            } else {
                content.classList.remove('scale-100', 'opacity-100');
                content.classList.add('scale-95', 'opacity-0');
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
        },

        toggleGuideModal: () => {
            const modal = document.getElementById('guide-modal');
            const content = document.getElementById('guide-modal-content');
            if(!modal) return;
            
            if (modal.classList.contains('hidden')) {
                Settings.guideStep = 0;
                Settings.updateGuideUI();
                modal.classList.remove('hidden');
                setTimeout(() => {
                    content.classList.remove('scale-95', 'opacity-0');
                    content.classList.add('scale-100', 'opacity-100');
                }, 10);
            } else {
                content.classList.remove('scale-100', 'opacity-100');
                content.classList.add('scale-95', 'opacity-0');
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
        },

        guideSlide: (dir) => {
            Settings.guideStep += dir;
            Settings.updateGuideUI();
        },

        updateGuideUI: () => {
            const slider = document.getElementById('guide-slider');
            const prev = document.getElementById('guide-prev');
            const next = document.getElementById('guide-next');
            const dots = document.getElementById('guide-dots').children;

            slider.style.transform = `translateX(-${Settings.guideStep * 33.333}%)`;

            prev.classList.toggle('opacity-50', Settings.guideStep === 0);
            prev.classList.toggle('pointer-events-none', Settings.guideStep === 0);
            
            next.classList.toggle('opacity-50', Settings.guideStep === 2);
            next.classList.toggle('pointer-events-none', Settings.guideStep === 2);

            Array.from(dots).forEach((dot, i) => {
                dot.className = i === Settings.guideStep 
                    ? "w-2 h-2 rounded-full bg-mono-black dark:bg-mono-white transition-colors" 
                    : "w-2 h-2 rounded-full bg-mono-300 dark:bg-mono-700 transition-colors";
            });
        }
    };

    // ==========================================
    // 8. INITIALIZATION BOOTSTRAPPER
    // ==========================================
    return {
        init: () => {
            Theme.init();
            
            const mobileBtn = document.getElementById('mobile-menu-btn');
            if(mobileBtn) mobileBtn.addEventListener('click', UI.toggleMobileMenu);
            
            Dashboard.init();
            ParallaxCards.init();
            Clients.init();
            Galleries.init();
            Settings.init();
        },
        Theme,
        UI,
        Auth,
        Clients,
        Galleries,
        Settings
    };

})();

// Boot Application
document.addEventListener('DOMContentLoaded', FF_Admin.init);