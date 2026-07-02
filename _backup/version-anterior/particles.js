// ==========================================
// SADA — Generador de Horarios FACPSI UNAM
// particles.js — Animación de partículas del landing
// ==========================================

// Particle Animation for Landing Page
(function () {
    const canvas = document.getElementById('ocean-dust');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height, particles = [];

    function init() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        createParticles();
    }

    function createParticles() {
        particles = [];
        // Density calculation: 1 particle per 10000 pixels
        const count = Math.floor((width * height) / 10000);
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2 + 0.5, // Random size between 0.5 and 2.5
                speed: Math.random() * 0.4 + 0.1, // Slow vertical drift
                opacity: Math.random() * 0.5 + 0.2 // Random transparency
            });
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.y -= p.speed; // Move upwards
            // Reset if off screen
            if (p.y < -5) p.y = height + 5;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            // Custom White Color
            ctx.fillStyle = 'rgba(255, 255, 255, ' + p.opacity + ')';
            ctx.fill();
        });
        requestAnimationFrame(animate);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        init();
    });

    // Start
    init();
    animate();
})();
