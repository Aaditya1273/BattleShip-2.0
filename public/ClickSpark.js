// ClickSpark.js - Water Edition
class ClickSpark {
  constructor(options = {}) {
    this.sparkColor = options.sparkColor || '#4db8ff';
    this.useRandomColors = options.useRandomColors || false;
    this.colorPalette = options.colorPalette || ['#4db8ff', '#00bfff', '#1e90ff', '#87cefa', '#b0e0e6'];
    this.sparkSize = options.sparkSize || 6;
    this.sparkRadius = options.sparkRadius || 25;
    this.sparkCount = options.sparkCount || 15;
    this.duration = options.duration || 1000;
    this.easing = options.easing || 'ease-out';
    this.extraScale = options.extraScale || 1.0;
    this.gravity = options.gravity || 0.08;
    this.isWater = options.isWater !== undefined ? options.isWater : true;
    
    this.canvas = null;
    this.ctx = null;
    this.sparks = [];
    this.animationId = null;
    this.initialized = false;
  }

  init(parentElement) {
    if (this.initialized) return;
    
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.userSelect = 'none';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    
    this.ctx = this.canvas.getContext('2d');
    
    // Add canvas to parent element
    const parent = parentElement || document.body;
    parent.appendChild(this.canvas);
    
    // Set canvas size
    this.resizeCanvas();
    
    // Add resize event listener
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Add click event listener to the document
    document.addEventListener('click', this.handleClick.bind(this));
    
    // Start animation loop
    this.animate();
    
    this.initialized = true;
  }
  
  resizeCanvas() {
    const { width, height } = window.innerWidth ? 
      { width: window.innerWidth, height: window.innerHeight } : 
      document.body.getBoundingClientRect();
    
    if (this.canvas && (this.canvas.width !== width || this.canvas.height !== height)) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }
  
  handleResize() {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => this.resizeCanvas(), 100);
  }
  
  getRandomColor() {
    if (!this.useRandomColors) return this.sparkColor;
    return this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
  }
  
  handleClick(e) {
    const { clientX, clientY } = e;
    const now = performance.now();
    
    // Create evenly distributed droplets in a perfect circle
    const newSparks = Array.from({ length: this.sparkCount }, (_, i) => {
      // Evenly distribute sparks in a complete circle (360 degrees)
      const angle = (2 * Math.PI * i) / this.sparkCount;
      
      // Random velocity for varied splash distance
      const velocity = 2 + Math.random() * 4;
      
      return {
        x: clientX,
        y: clientY,
        angle: angle,
        velocity: velocity,
        startTime: now,
        color: this.getRandomColor(),
        size: this.sparkSize * (0.6 + Math.random() * 0.8), // Varied droplet sizes
        gravity: this.gravity * (0.8 + Math.random() * 0.5), // Slight randomized gravity
        opacity: 0.9
      };
    });
    
    this.sparks.push(...newSparks);
  }
  
  easeFunc(t) {
    switch (this.easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default: // ease-out
        return t * (2 - t);
    }
  }
  
  animate() {
    const draw = (timestamp) => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.sparks = this.sparks.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= this.duration) {
          return false;
        }
        
        const progress = elapsed / this.duration;
        const eased = this.easeFunc(progress);
        
        // Update position with gravity effect for water
        const distance = spark.velocity * elapsed / 50;
        
        // Apply gravity for water effect
        let x, y;
        if (this.isWater) {
          const gravityEffect = 0.5 * spark.gravity * Math.pow(elapsed / 100, 2);
          
          // Calculate position with circular pattern and gravity
          x = spark.x + distance * Math.cos(spark.angle);
          y = spark.y + distance * Math.sin(spark.angle) + gravityEffect;
          
          // Small random variation for natural movement
          if (progress > 0.2) {
            x += Math.sin(elapsed / 50) * 1;
          }
        } else {
          // Original spark behavior
          x = spark.x + distance * Math.cos(spark.angle);
          y = spark.y + distance * Math.sin(spark.angle);
        }
        
        // Adjust size and opacity based on progress
        const currentSize = spark.size * (1 - eased * 0.5);
        const currentOpacity = spark.opacity * (1 - progress);
        
        // Draw water droplet
        this.ctx.globalAlpha = currentOpacity;
        this.ctx.fillStyle = spark.color;
        
        // Draw a teardrop shape for water effect
        if (this.isWater) {
          this.ctx.beginPath();
          this.ctx.arc(x, y, currentSize, 0, Math.PI * 2);
          
          // Add slight shadow/highlight for 3D effect
          const gradient = this.ctx.createRadialGradient(
            x - currentSize * 0.3, y - currentSize * 0.3, currentSize * 0.2,
            x, y, currentSize
          );
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
          gradient.addColorStop(0.5, spark.color);
          gradient.addColorStop(1, 'rgba(0, 0, 100, 0.2)');
          
          this.ctx.fillStyle = gradient;
          this.ctx.fill();
          
          // Add a small trail/tail for faster droplets
          if (elapsed > 100 && spark.velocity > 3) {
            const trailSize = currentSize * 0.7;
            this.ctx.globalAlpha = currentOpacity * 0.5;
            this.ctx.beginPath();
            this.ctx.arc(
              x - 2 * Math.cos(spark.angle), 
              y - 2 * Math.sin(spark.angle),
              trailSize, 0, Math.PI * 2
            );
            this.ctx.fillStyle = spark.color;
            this.ctx.fill();
          }
        } else {
          // Regular circular spark
          this.ctx.beginPath();
          this.ctx.arc(x, y, currentSize, 0, Math.PI * 2);
          this.ctx.fill();
        }
        
        this.ctx.globalAlpha = 1.0;
        
        return true;
      });
      
      this.animationId = requestAnimationFrame(draw);
    };
    
    this.animationId = requestAnimationFrame(draw);
  }
  
  destroy() {
    if (!this.initialized) return;
    
    window.removeEventListener('resize', this.handleResize.bind(this));
    document.removeEventListener('click', this.handleClick.bind(this));
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    this.initialized = false;
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.ClickSpark = ClickSpark;
} 