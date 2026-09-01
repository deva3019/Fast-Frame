/**
 * FastFrame Authentication Engine - Cinematic Edition
 * Handles Login, Registration, Slideshows, and UI Focus States.
 */

const FF_Auth = (() => {

    // ==========================================
    // 1. TOAST NOTIFICATIONS
    // ==========================================
    const Toast = {
        show: (message, type = 'info') => {
            const container = document.getElementById('toast-container');
            if(!container) return;
            const toast = document.createElement('div');
            const bgClass = type === 'error' ? 'bg-red-600' : 'bg-mono-white';
            const textClass = type === 'error' ? 'text-white' : 'text-mono-black';

            toast.className = `flex items-center gap-3 px-6 py-3 shadow-2xl rounded-lg ${bgClass} ${textClass} opacity-0 transform -translate-y-4 transition-all duration-300 w-full`;
            toast.innerHTML = `<span class="text-[10px] font-bold tracking-widest uppercase text-center w-full">${message}</span>`;

            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.remove('opacity-0', '-translate-y-4'));

            setTimeout(() => {
                toast.classList.add('opacity-0', '-translate-y-4');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    };

    // ==========================================
    // 2. CINEMATIC EFFECTS (Slideshow & Focus)
    // ==========================================
    const Cinematic = {
        init: () => {
            // Background Slideshow
            const slides = document.querySelectorAll('.bg-slide');
            if(slides.length > 0) {
                let currentSlide = 0;
                setInterval(() => {
                    slides[currentSlide].classList.remove('active');
                    currentSlide = (currentSlide + 1) % slides.length;
                    slides[currentSlide].classList.add('active');
                }, 6000);
            }

            // Aperture Focus Effect
            const focusLayer = document.getElementById('focus-layer');
            const triggers = document.querySelectorAll('.focus-trigger');
            
            triggers.forEach(input => {
                input.addEventListener('focus', () => focusLayer?.classList.add('focused'));
                input.addEventListener('blur', () => focusLayer?.classList.remove('focused'));
            });

            // Aperture Password Toggle
            const toggleBtn = document.getElementById('toggle-pwd');
            const pwdInput = document.getElementById('password');
            const iconPath = document.getElementById('aperture-path');
            
            if (toggleBtn && pwdInput && iconPath) {
                toggleBtn.addEventListener('click', () => {
                    const isPwd = pwdInput.type === 'password';
                    pwdInput.type = isPwd ? 'text' : 'password';
                    // Swap icon between Aperture (closed) and Eye (open)
                    if (isPwd) {
                        iconPath.setAttribute('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z');
                    } else {
                        iconPath.setAttribute('d', 'M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM12 22V12M12 2V12M2 12H12M22 12H12M4.92893 4.92893L12 12M19.0711 19.0711L12 12M19.0711 4.92893L12 12M4.92893 19.0711L12 12');
                    }
                });
            }
        },
        shutterFlash: () => {
            const flash = document.getElementById('shutter-flash');
            if (flash) {
                flash.classList.remove('animate-shutter');
                void flash.offsetWidth; // Trigger reflow
                flash.classList.add('animate-shutter');
            }
        }
    };

    // ==========================================
    // 3. LOGIN LOGIC
    // ==========================================
    const Login = {
        init: () => {
            const form = document.getElementById('login-form');
            if (!form) return;

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('submit-btn');
                const originalHtml = btn.innerHTML;

                btn.innerHTML = `<span class="animate-pulse">Authenticating...</span>`;
                btn.disabled = true;

                try {
                    const res = await fetch('/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: document.getElementById('email').value,
                            password: document.getElementById('password').value
                        })
                    });

                    const data = await res.json();

                    if (data.success) {
                        Cinematic.shutterFlash();
                        btn.innerHTML = `<span class="text-mono-black">Access Granted</span>`;
                        setTimeout(() => window.location.href = data.redirect, 400);
                    } else {
                        throw new Error(data.error || "Authentication failed.");
                    }
                } catch (err) {
                    Toast.show(err.message, "error");
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            });
        }
    };

    // ==========================================
    // 4. REGISTRATION LOGIC
    // ==========================================
    const Register = {
        init: () => {
            const form = document.getElementById('register-form');
            if (!form) return;

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const payload = {
                    studio_name: document.getElementById('reg-name').value,
                    email: document.getElementById('reg-email').value,
                    password: document.getElementById('reg-password').value
                };
                sessionStorage.setItem('ff_reg_payload', JSON.stringify(payload));
                Cinematic.shutterFlash();
                setTimeout(() => window.location.href = "/auth/verify", 400);
            });
        }
    };

    // ==========================================
    // 5. VERIFICATION LOGIC
    // ==========================================
    const Verify = {
        init: () => {
            const form = document.getElementById('verify-form');
            if (!form) return;

            const payloadStr = sessionStorage.getItem('ff_reg_payload');
            if (!payloadStr) {
                window.location.href = "/auth/register";
                return;
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('verify-submit-btn');
                const originalHtml = btn.innerHTML;

                btn.innerHTML = `<span class="animate-pulse">Verifying...</span>`;
                btn.disabled = true;

                try {
                    const payload = JSON.parse(payloadStr);
                    payload.security_code = document.getElementById('security-code').value;

                    const res = await fetch('/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();

                    if (data.success) {
                        sessionStorage.removeItem('ff_reg_payload');
                        Cinematic.shutterFlash();
                        btn.innerHTML = `<span class="text-mono-black">System Unlocked</span>`;
                        setTimeout(() => window.location.href = data.redirect, 400);
                    } else {
                        throw new Error(data.error || "Invalid security code.");
                    }
                } catch (err) {
                    Toast.show(err.message, "error");
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            });
        },
        cancel: () => {
            sessionStorage.removeItem('ff_reg_payload');
            window.location.href = "/auth/register";
        }
    };

    return {
        init: () => {
            Cinematic.init();
            Login.init();
            Register.init();
            Verify.init();
        },
        Verify
    };
})();

document.addEventListener('DOMContentLoaded', FF_Auth.init);