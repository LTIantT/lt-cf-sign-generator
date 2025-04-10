<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { browser } from '$app/environment';
  import { jsPDF } from 'jspdf';

  // Props
  export let title: string = '';
  export let price: string = '';
  export let sku: string = '';
  export let templatePath: string = '/img/template/template.jpg';
  // New prop for custom title font size (null means use auto-calculated size)
  export let titleFontSize: number | null = null;
  
  // Canvas element reference
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let templateImage: HTMLImageElement;
  let fontLoaded = false;
  
  // Canvas dimensions (11x8.5 inches at 300dpi, landscape orientation)
  const dpi = 300;
  const width = 11 * dpi;
  const height = 8.5 * dpi;

  // Calculate scale factor compared to previous 72dpi
  const scaleFactor = dpi / 72;
  
  // Load font and setup canvas
  onMount(async () => {
    if (!browser) return;
    
    // Use a safer approach to ensure Montserrat font is loaded
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap';
    document.head.appendChild(link);
    
    // Wait for fonts to load
    await document.fonts.ready;
    
    // Check if Montserrat is available
    if (document.fonts.check('bold 16px Montserrat')) {
      fontLoaded = true;
    } else {
      // Fallback to system fonts if Montserrat is not available
      console.warn('Montserrat font not available, using system fonts');
      fontLoaded = true; // Still proceed with drawing
    }
    
    // Load template image
    templateImage = new Image();
    templateImage.src = templatePath;
    templateImage.onload = () => {
      drawCanvas();
    };
    
    // Setup canvas context
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;
  });
  
  // Update canvas when props change
  afterUpdate(() => {
    if (!browser) return;
    if (ctx && templateImage && fontLoaded) {
      drawCanvas();
    }
  });

  // Function to download the canvas as PDF
  function downloadAsPDF() {
    if (!browser || !canvas) return;
    
    // Create a new jsPDF instance in landscape orientation
    // 11x8.5 inches in points (72 dpi)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'in',
      format: [11, 8.5]
    });
    
    // Convert canvas to an image data URL
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    
    // Add the image to the PDF (position: 0,0 and size: 11x8.5 inches)
    pdf.addImage(imgData, 'JPEG', 0, 0, 11, 8.5);
    
    // Generate filename with SKU (if available)
    const filename = sku ? 
      `price-sign-${sku.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf` : 
      'price-sign.pdf';
    
    // Save the PDF
    pdf.save(filename);
  }
  
  // Function to calculate the optimal font size for text to fit within a bounding box
  function calculateOptimalFontSize(
    ctx: CanvasRenderingContext2D, 
    text: string, 
    maxFontSize: number,
    boxWidth: number, 
    boxHeight: number, 
    numLines: number = 2,
    fontFamily: string = 'Montserrat, Arial, sans-serif'
  ): number {
    // If no text, return the max font size
    if (!text.trim()) return maxFontSize;
    
    // Start with binary search parameters
    let min = 1;  // Minimum font size in pt (scaled)
    let max = maxFontSize;  // Maximum font size in pt (scaled)
    let optimal = min;
    
    // Check if text has spaces
    const hasSpaces = text.includes(' ');
    
    // Split text into words only if it contains spaces
    const words = hasSpaces ? text.split(' ') : [text];
    
    // Binary search to find the optimal font size
    while (min <= max) {
      const mid = Math.floor((min + max) / 2);
      
      // Set font to test this size
      ctx.font = `bold ${mid}pt ${fontFamily}`;
      
      // Handle single words or strings without spaces differently
      if (!hasSpaces) {
        // For single words or strings without spaces, just check if it fits the width
        const metrics = ctx.measureText(text);
        if (metrics.width <= boxWidth && mid * 1.2 <= boxHeight) {
          optimal = mid;  // This size works, try larger
          min = mid + 1;
        } else {
          max = mid - 1;  // Too big, try smaller
        }
        continue;
      }
      
      // For text with spaces, calculate how many lines it will take
      let actualLineCount = 0;
      let remainingWords = [...words]; // Clone the words array
      
      // Keep processing until we're out of words or exceed the line limit
      while (remainingWords.length > 0 && actualLineCount < numLines) {
        actualLineCount++;
        let line = '';
        let wordIndex = 0;
        
        // Try to fit as many words as possible in this line
        while (wordIndex < remainingWords.length) {
          const testLine = line + (line ? ' ' : '') + remainingWords[wordIndex];
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width <= boxWidth) {
            line = testLine;
            wordIndex++;
          } else {
            // Word doesn't fit, stop adding words to this line
            break;
          }
        }
        
        // If we couldn't fit any words on this line, it means even a single word is too wide
        if (wordIndex === 0) {
          max = mid - 1; // Font too big, reduce and try again
          break;
        }
        
        // Remove the words we've used for this line
        remainingWords = remainingWords.slice(wordIndex);
      }
      
      // Now check if all words fit within the allowed number of lines
      if (remainingWords.length === 0 && actualLineCount <= numLines) {
        // All words fit, this font size works, try larger
        optimal = mid;
        min = mid + 1;
      } else {
        // Not all words fit, or we needed more than the allowed number of lines
        max = mid - 1;
      }
    }
    
    return optimal;
  }
  
  // Function to wrap text to fit within maxWidth
  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number = 2) {
    const words = text.toUpperCase().split(' ');
    const lines: string[] = [];
    
    // Use the same algorithm as in calculateOptimalFontSize to ensure consistent line breaking
    let remainingWords = [...words];
    let lineCount = 0;
    
    // Keep processing until we're out of words or reach the maximum lines
    while (remainingWords.length > 0 && lineCount < maxLines) {
      let line = '';
      let wordIndex = 0;
      
      // Try to fit as many words as possible in this line
      while (wordIndex < remainingWords.length) {
        const testLine = line + (line ? ' ' : '') + remainingWords[wordIndex];
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width <= maxWidth) {
          line = testLine;
          wordIndex++;
        } else {
          // Word doesn't fit, stop adding words to this line
          break;
        }
      }
      
      // Edge case: if we couldn't fit even a single word, force it on this line
      // but truncate it to fit the width
      if (wordIndex === 0 && remainingWords.length > 0) {
        // Just take the first word and truncate it if needed
        const word = remainingWords[0];
        line = word;
        wordIndex = 1;
        
        // Check if the single word is too long and needs truncation
        const metrics = ctx.measureText(word);
        if (metrics.width > maxWidth) {
          // This shouldn't happen with proper font size calculation,
          // but we'll handle it just in case
          let truncated = word;
          while (ctx.measureText(truncated).width > maxWidth && truncated.length > 1) {
            truncated = truncated.substring(0, truncated.length - 1);
          }
          line = truncated;
        }
      }
      
      // Add the line and remove the used words
      lines.push(line);
      remainingWords = remainingWords.slice(wordIndex);
      lineCount++;
    }
    
    // Calculate total height to center vertically within the area
    const totalHeight = lines.length * lineHeight;
    const startY = y - (totalHeight / 2) + (lineHeight / 2);
    
    // Draw each line
    for (let i = 0; i < lines.length; i++) {
      // Draw the stroke first (if needed)
      ctx.strokeText(lines[i], x, startY + (i * lineHeight));
      // Then draw the fill
      ctx.fillText(lines[i], x, startY + (i * lineHeight));
    }
  }
  
  // Draw the canvas with template and text
  function drawCanvas() {
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw template image
    ctx.drawImage(templateImage, 0, 0, width, height);
    
    // Draw title text - Calculate optimal font size for 300dpi or use custom size
    const maxTitleFontSize = Math.round(75 * scaleFactor);
    const titleBoxWidth = 3148; // Fixed width for title box (in pixels)
    const titleBoxHeight = 800; // Fixed height for title box (in pixels)
    
    // Use provided font size if available, otherwise calculate optimal size
    const calculatedTitleFontSize = titleFontSize !== null 
      ? Math.min(titleFontSize, maxTitleFontSize) // Ensure it doesn't exceed max
      : calculateOptimalFontSize(
          ctx,
          title,
          maxTitleFontSize,
          titleBoxWidth,
          titleBoxHeight,
          2
        );
    
    ctx.font = `bold ${calculatedTitleFontSize}pt Montserrat, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Calculate position (center horizontally, positioned at 1/4 from top)
    const titleX = width / 2;
    const titleY = height / 4.8;

    // Slightly increase the separation between the letters for better stroke visibility
    ctx.letterSpacing = '2px';
    ctx.lineJoin = 'round';
    
    // Add black stroke - scale stroke width for higher DPI
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 10 * scaleFactor;
    
    // Fill with white
    ctx.fillStyle = 'white';
    
    // Wrap text with calculated font size - scale line height for higher DPI
    wrapText(ctx, title, titleX, titleY, titleBoxWidth, calculatedTitleFontSize * 1.2, 2);
    
    // Draw price text - Calculate optimal font size for 300dpi
    const maxPriceFontSize = Math.round(160 * scaleFactor);
    const priceBoxWidth = 3128; // Fixed width for price box (in pixels)
    const priceBoxHeight = 832; // Fixed height for price box (in pixels)
    
    const priceFontSize = calculateOptimalFontSize(
      ctx,
      price,
      maxPriceFontSize,
      priceBoxWidth,
      priceBoxHeight,
      1
    );
    
    ctx.font = `bold ${priceFontSize}pt Montserrat, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Calculate position (center horizontally, positioned at 2/3 from top)
    const priceX = width / 2;
    const priceY = height * 2/3;
    
    // Fill with black
    ctx.fillStyle = 'black';
    ctx.fillText(price, priceX, priceY);
    
    // Draw SKU text - Calculate optimal font size for 300dpi
    const maxSkuFontSize = Math.round(16 * scaleFactor);
    const skuBoxWidth = width * 0.3;
    const skuBoxHeight = height * 0.05;
    
    const skuFontSize = calculateOptimalFontSize(
      ctx,
      sku,
      maxSkuFontSize,
      skuBoxWidth,
      skuBoxHeight,
      1
    );
    
    ctx.font = `bold ${skuFontSize}pt Montserrat, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    // Position SKU in the middle of the page horizontally with the same Y position
    const skuX = width / 2;
    const skuY = height - (60 * scaleFactor);
    
    // Fill with black
    ctx.fillStyle = 'black';
    ctx.fillText(`${sku.toUpperCase()}`, skuX, skuY);
  }
</script>

<svelte:head>
  <!-- Preload the font to ensure it's available -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap" rel="stylesheet">
</svelte:head>

<div class="canvas-container">
  <canvas bind:this={canvas} width={width} height={height}></canvas>
  <button class="download-btn cursor-pointer" on:click={downloadAsPDF}>Download PDF</button>
</div>

<style>
  .canvas-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 20px 0;
  }
  
  canvas {
    max-width: 100%;
    height: auto;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
    margin-bottom: 15px;
  }
  
  .download-btn {
    background-color: #0077cc;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .download-btn:hover {
    background-color: #005fa3;
  }
  
  .cursor-pointer {
    cursor: pointer;
  }
</style>
