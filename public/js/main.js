// Typewriter effect for hero section
class TypewriterEffect {
    constructor(element, phrases, speed = 100, deleteSpeed = 50, pauseTime = 2000) {
        this.element = element;
        this.phrases = phrases;
        this.speed = speed;
        this.deleteSpeed = deleteSpeed;
        this.pauseTime = pauseTime;
        this.currentPhraseIndex = 0;
        this.currentCharIndex = 0;
        this.isDeleting = false;
        this.isPaused = false;
        
        this.start();
    }
    
    start() {
        this.type();
    }
    
    type() {
        const currentPhrase = this.phrases[this.currentPhraseIndex];
        
        if (this.isPaused) {
            setTimeout(() => {
                this.isPaused = false;
                this.type();
            }, this.pauseTime);
            return;
        }
        
        if (!this.isDeleting) {
            // Typing
            if (this.currentCharIndex < currentPhrase.length) {
                this.element.textContent = currentPhrase.substring(0, this.currentCharIndex + 1);
                this.currentCharIndex++;
                setTimeout(() => this.type(), this.speed);
            } else {
                // Finished typing, pause then start deleting
                this.isPaused = true;
                this.isDeleting = true;
                this.type();
            }
        } else {
            // Deleting
            if (this.currentCharIndex > 0) {
                this.element.textContent = currentPhrase.substring(0, this.currentCharIndex - 1);
                this.currentCharIndex--;
                setTimeout(() => this.type(), this.deleteSpeed);
            } else {
                // Finished deleting, move to next phrase
                this.isDeleting = false;
                this.currentPhraseIndex = (this.currentPhraseIndex + 1) % this.phrases.length;
                setTimeout(() => this.type(), this.speed);
            }
        }
    }
}

// Mobile menu functionality
class MobileMenu {
    constructor() {
        this.menuButton = document.getElementById('mobile-menu-button');
        this.mobileMenu = document.getElementById('mobile-menu');
        this.closeButton = document.getElementById('close-menu');
        this.backdrop = document.getElementById('mobile-backdrop');
        this.menuPanel = this.mobileMenu?.querySelector('.transform');
        
        this.init();
    }
    
    init() {
        if (!this.menuButton || !this.mobileMenu) return;
        
        this.menuButton.addEventListener('click', () => this.openMenu());
        this.closeButton?.addEventListener('click', () => this.closeMenu());
        this.backdrop?.addEventListener('click', () => this.closeMenu());
        
        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.mobileMenu.classList.contains('hidden')) {
                this.closeMenu();
            }
        });

        // Close menu when a link is clicked
        const menuLinks = this.mobileMenu.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('click', () => this.closeMenu());
        });
    }
    
    openMenu() {
        this.mobileMenu.classList.remove('hidden');
        this.mobileMenu.setAttribute('aria-hidden', 'false');
        
        // Trigger animation
        setTimeout(() => {
            this.menuPanel?.classList.remove('translate-x-full');
        }, 10);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
    
    closeMenu() {
        this.menuPanel?.classList.add('translate-x-full');
        
        setTimeout(() => {
            this.mobileMenu.classList.add('hidden');
            this.mobileMenu.setAttribute('aria-hidden', 'true');
        }, 300);
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

// Header scroll effect
class HeaderScrollEffect {
    constructor() {
        this.header = document.querySelector('header');
        this.init();
    }
    
    init() {
        if (!this.header) return;
        
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                this.header.classList.add('bg-white/95', 'shadow-lg');
                this.header.classList.remove('bg-transparent');
                
                // Change text colors for better contrast on white background
                const textElements = this.header.querySelectorAll('.text-white');
                textElements.forEach(el => {
                    el.classList.remove('text-white');
                    el.classList.add('text-gray-900');
                });
            } else {
                this.header.classList.remove('bg-white/95', 'shadow-lg');
                this.header.classList.add('bg-transparent');
                
                // Restore white text
                const textElements = this.header.querySelectorAll('.text-gray-900');
                textElements.forEach(el => {
                    el.classList.remove('text-gray-900');
                    el.classList.add('text-white');
                });
            }
        });
    }
}

// Smooth scroll for anchor links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Fade up animation on scroll
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements with fade-up classes
    document.querySelectorAll('.fade-up-1, .fade-up-2, .fade-up-3').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize typewriter effect
    const typewriterElement = document.querySelector('.text-animation');
    if (typewriterElement) {
        const phrases = [
            'find your perfect car',
            'get the best deals',
            'trade in your vehicle',
            'secure financing',
            'consign your vehicle'
        ];
        new TypewriterEffect(typewriterElement, phrases, 80, 40, 2500);
    }
    
    // Initialize mobile menu
    new MobileMenu();
    
    // Initialize header scroll effect
    new HeaderScrollEffect();
    
    // Initialize smooth scrolling
    initSmoothScroll();
    
    // Initialize scroll animations
    initScrollAnimations();
});