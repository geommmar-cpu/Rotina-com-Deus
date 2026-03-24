import './style.css';

// Premium Animations for Rotina com Deus

const observerOptions = {
  threshold: 0.05,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('active');
      // If it's a grid, stagger its children
      if (entry.target.classList.contains('features-grid')) {
        const cards = entry.target.querySelectorAll('.glass-card');
        cards.forEach((card, index) => {
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0) scale(1)';
          }, index * 150);
        });
      }
    }
  });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
  const revealElements = document.querySelectorAll('.reveal');
  revealElements.forEach((el) => observer.observe(el));

  // Add parallax effect to hero background on scroll
  window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    const scroll = window.pageYOffset;
    if (hero) {
      hero.style.backgroundPositionY = `${scroll * 0.5}px`;
    }
  });

  // Smooth scroll for nav links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });

  // Sticky Header Effect
  const header = document.querySelector('#main-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
});
