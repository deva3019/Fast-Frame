document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. LENIS SMOOTH SCROLLING
    // ==========================================
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // standard ease-out
        smooth: true,
        smoothTouch: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);


    // ==========================================
    // 2. THEME & INTERACTIVE LAMP ROPE
    // ==========================================
    const applyTheme = (isDark) => {
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('ff-theme', isDark ? 'dark' : 'light');
    };

    const storedTheme = localStorage.getItem('ff-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(storedTheme === 'dark' || (!storedTheme && prefersDark));

    const toggleTheme = () => applyTheme(!document.documentElement.classList.contains('dark'));

    // Physics Rope Drag Logic
    const cord = document.getElementById('lamp-cord');
    const pull = document.getElementById('lamp-pull');
    const flash = document.getElementById('theme-flash');
    
    let isDragging = false;
    let startY = 0;
    let currentY = 0;
    const threshold = 60; // Pixels to pull before triggering switch

    const startDrag = (e) => {
        isDragging = true;
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        pull.style.transition = 'none';
        cord.style.transition = 'none';
        document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    };

    const drag = (e) => {
        if (!isDragging) return;
        const y = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        currentY = Math.max(0, y - startY); // Only allow pulling downward
        
        // Apply friction to the drag distance (feels heavier)
        const pullDistance = currentY * 0.4;
        
        pull.style.transform = `translateY(${pullDistance}px)`;
        // The cord is h-16 (64px). We scale it Y to stretch.
        cord.style.transform = `scaleY(${1 + (pullDistance / 64)})`;
    };

    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.userSelect = '';
        
        // CSS Bouncy Spring transitions
        const spring = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        pull.style.transition = spring;
        cord.style.transition = spring;
        
        // If pulled past threshold, toggle theme and trigger flash
        if (currentY * 0.4 > threshold) {
            toggleTheme();
            
            // Trigger cinematic radial flash
            flash.classList.add('flash-active');
            setTimeout(() => {
                flash.classList.remove('flash-active');
            }, 800);
        }
        
        // Snap back to origin
        pull.style.transform = `translateY(0px)`;
        cord.style.transform = `scaleY(1)`;
        currentY = 0;
    };

    // Attach Rope Events (Mouse & Touch)
    pull.addEventListener('mousedown', startDrag);
    pull.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('mousemove', drag);
    window.addEventListener('touchmove', drag, { passive: true });
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);


    // ==========================================
    // 3. MOBILE NAVIGATION
    // ==========================================
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const line1 = document.getElementById('line-1');
    const line2 = document.getElementById('line-2');
    let isMenuOpen = false;

    const toggleMenu = () => {
        isMenuOpen = !isMenuOpen;
        mobileMenu.classList.toggle('opacity-0', !isMenuOpen);
        mobileMenu.classList.toggle('pointer-events-none', !isMenuOpen);
        if(isMenuOpen) {
            lenis.stop(); // Pause smooth scrolling while menu is open
        } else {
            lenis.start();
        }
        
        line1.style.transform = isMenuOpen ? 'translateY(4px) rotate(45deg)' : 'none';
        line2.style.transform = isMenuOpen ? 'translateY(-4px) rotate(-45deg)' : 'none';
        line2.style.width = isMenuOpen ? '1.5rem' : '1rem';
    };

    mobileBtn?.addEventListener('click', toggleMenu);
    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => { if (isMenuOpen) toggleMenu(); });
    });


    // ==========================================
    // 4. HARDWARE-ACCELERATED SCROLL REVEAL
    // ==========================================
    const revealOptions = { root: null, rootMargin: '0px', threshold: 0.15 };
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));


    // ==========================================
    // 5. STICKY PARALLAX OPACITY FADE
    // ==========================================
    const stickyCards = document.querySelectorAll('.sticky-card');
    lenis.on('scroll', () => {
        stickyCards.forEach((card, index) => {
            if (index < stickyCards.length - 1) {
                const rect = card.getBoundingClientRect();
                const nextRect = stickyCards[index + 1].getBoundingClientRect();
                if (nextRect.top < rect.bottom) {
                    const opacity = Math.max(0, (nextRect.top - rect.top) / rect.height);
                    card.style.filter = `brightness(${0.5 + (opacity * 0.5)})`;
                } else {
                    card.style.filter = 'brightness(1)';
                }
            }
        });
    });


    // ==========================================
    // 6. MAGNETIC BUTTON PHYSICS
    // ==========================================
    const magneticWraps = document.querySelectorAll('.magnetic-wrap');
    
    magneticWraps.forEach(wrap => {
        const inner = wrap.querySelector('.magnetic-inner');
        
        wrap.addEventListener('mousemove', (e) => {
            const rect = wrap.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            inner.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
        });
        
        wrap.addEventListener('mouseleave', () => {
            inner.style.transform = 'translate(0px, 0px)';
        });
    });


    // ==========================================
    // 7. CLIENT ACCESS FORM HANDLING
    // ==========================================
    const accessForm = document.getElementById('accessForm');
    if (accessForm) {
        accessForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const specialId = document.getElementById('special_id').value.trim().toUpperCase();
            
            if (specialId) {
                const btn = accessForm.querySelector('button');
                btn.innerHTML = `Verifying... <span class="animate-pulse ml-2 text-xl leading-none">&rarr;</span>`;
                btn.disabled = true;
                
                setTimeout(() => window.location.href = `/gallery/${specialId}`, 400);
            }
        });
    }


    // ==========================================
    // 8. MODAL ANIMATION CONTROLLER
    // ==========================================
    const devModal = document.getElementById('dev-modal');
    const modalContent = document.getElementById('dev-modal-content');
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                if (!devModal.classList.contains('hidden')) {
                    lenis.stop(); // Stop scroll while modal is open
                    setTimeout(() => {
                        modalContent.classList.remove('scale-95', 'opacity-0');
                        modalContent.classList.add('scale-100', 'opacity-100');
                    }, 10);
                } else {
                    lenis.start();
                    modalContent.classList.remove('scale-100', 'opacity-100');
                    modalContent.classList.add('scale-95', 'opacity-0');
                }
            }
        });
    });
    
    if (devModal) observer.observe(devModal, { attributes: true });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && devModal) {
            devModal.classList.add('hidden');
        }
    });
});