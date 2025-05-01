/**
 * Water Transition Effect
 * Creates a water/ocean effect when navigating between pages
 */

class WaterTransition {
  constructor(options = {}) {
    this.duration = options.duration || 1500;
    this.bubbleCount = options.bubbleCount || 30;
    this.initialized = false;
    this.init();
  }

  init() {
    if (this.initialized) return;
    
    // Create transition container if it doesn't exist
    if (!document.getElementById('water-transition')) {
      const transitionContainer = document.createElement('div');
      transitionContainer.className = 'water-transition';
      transitionContainer.id = 'water-transition';
      
      const ripple = document.createElement('div');
      ripple.className = 'water-ripple';
      
      const wave = document.createElement('div');
      wave.className = 'water-wave';
      
      const bubbles = document.createElement('div');
      bubbles.className = 'bubbles';
      bubbles.id = 'bubbles';
      
      transitionContainer.appendChild(ripple);
      transitionContainer.appendChild(wave);
      transitionContainer.appendChild(bubbles);
      
      document.body.appendChild(transitionContainer);
    }
    
    this.transitionElement = document.getElementById('water-transition');
    this.bubblesContainer = document.getElementById('bubbles');
    
    // Ensure transition is not active when initializing
    if (this.transitionElement) {
      this.transitionElement.classList.remove('active', 'reverse');
    }
    
    // Add transition to all links with data-water-transition attribute
    const waterLinks = document.querySelectorAll('[data-water-transition]');
    waterLinks.forEach(link => {
      link.addEventListener('click', (e) => this.handleLinkClick(e, link));
    });
    
    // Add transition for back links with data-water-back attribute
    const backLinks = document.querySelectorAll('[data-water-back]');
    backLinks.forEach(link => {
      link.addEventListener('click', (e) => this.handleBackLinkClick(e, link));
    });
    
    // Check if we need to show entrance animation
    if (document.referrer && 
        (document.referrer.includes('/index.html') || 
         document.referrer === window.location.origin + '/')) {
      this.showEntranceAnimation();
    }
    
    // Add back link to page if on a game page
    this.addBackLink();
    
    this.initialized = true;
  }
  
  addBackLink() {
    // Only add back link if we're not on the index page
    if (window.location.pathname !== '/' && 
        window.location.pathname !== '/index.html' &&
        !document.querySelector('.back-to-home')) {
      
      const backLink = document.createElement('a');
      backLink.href = '/index.html';
      backLink.className = 'btn back-to-home';
      backLink.setAttribute('data-water-back', 'true');
      backLink.innerHTML = 'Back to Home';
      
      // Find appropriate container to add the back link
      const container = document.querySelector('.game-container');
      if (container) {
        backLink.style.position = 'fixed';
        backLink.style.top = '20px';
        backLink.style.left = '20px';
        backLink.style.zIndex = '100';
        document.body.appendChild(backLink);
      }
    }
  }
  
  handleLinkClick(e, link) {
    e.preventDefault();
    const href = link.getAttribute('href');
    
    // Clear any existing transition states
    this.reset();
    
    // Create new transition
    this.createBubbles();
    this.transitionElement.classList.add('active');
    
    setTimeout(() => {
      window.location.href = href;
    }, this.duration);
  }
  
  handleBackLinkClick(e, link) {
    e.preventDefault();
    const href = link.getAttribute('href');
    
    // Clear any existing transition states
    this.reset();
    
    // Different transition effect for going back
    this.createBubbles();
    
    // Add reverse active class to create a different animation
    this.transitionElement.classList.add('active', 'reverse');
    
    setTimeout(() => {
      window.location.href = href;
    }, this.duration);
  }
  
  reset() {
    // Remove any existing classes
    if (this.transitionElement) {
      this.transitionElement.classList.remove('active', 'reverse');
      
      // Force a reflow to ensure animations start fresh
      void this.transitionElement.offsetWidth;
    }
    
    // Clear bubbles
    if (this.bubblesContainer) {
      this.bubblesContainer.innerHTML = '';
    }
  }
  
  createBubbles() {
    // Clear existing bubbles
    this.bubblesContainer.innerHTML = '';
    
    // Create random bubbles
    for (let i = 0; i < this.bubbleCount; i++) {
      const bubble = document.createElement('div');
      bubble.classList.add('bubble');
      
      // Random position, size and delay
      const size = Math.random() * 50 + 10;
      const left = Math.random() * 100;
      const delay = Math.random() * 0.5;
      
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${left}%`;
      bubble.style.animationDelay = `${delay}s`;
      
      this.bubblesContainer.appendChild(bubble);
    }
  }
  
  showEntranceAnimation() {
    // Create entrance effect - rising from the water
    document.body.classList.add('water-entrance');
    
    // Add bubbles rising from bottom
    this.createBubbles();
    
    // Remove class after animation completes
    setTimeout(() => {
      document.body.classList.remove('water-entrance');
    }, 2000);
  }
  
  // Method to manually close the transition
  close() {
    if (this.transitionElement) {
      this.transitionElement.classList.remove('active', 'reverse');
    }
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.waterTransition = new WaterTransition();
  
  // Handle case where transition might be stuck after navigation
  const transitionElement = document.getElementById('water-transition');
  if (transitionElement && transitionElement.classList.contains('active')) {
    // Wait a moment then remove active class to avoid stuck transitions
    setTimeout(() => {
      transitionElement.classList.remove('active', 'reverse');
    }, 100);
  }
  
  // Special handling for index page
  if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    // Make sure no transition is active on landing page
    const transitionElement = document.getElementById('water-transition');
    if (transitionElement) {
      transitionElement.classList.remove('active', 'reverse');
    }
  }
}); 