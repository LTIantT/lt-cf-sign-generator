<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { browser } from '$app/environment';
  import { jsPDF } from 'jspdf';

  // Props
  export let title: string = '';
  export let price: string = '';
  export let sku: string = '';
  export let templatePath: string = '/img/template/template.jpg';
  // Whether to render the Code 39 barcode ("With UPC" layout)
  export let showBarcode: boolean = false;
  // New prop for custom title font size (null means use auto-calculated size)
  export let titleFontSize: number | null = null;
  export let originalPrice: string = '';
  // Optional line of text shown below the SKU when the barcode layout is used
  export let instructionalText: string = '';
  export let instructionalTextColor: string = '#000000';
  export let saleImageSrc: string = '';
  export let useSaleImageTemplate: boolean = false;
  export let saleImageScale: number = 1.0;
  
  // Canvas element reference
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let templateImage: HTMLImageElement | null = null;
  let saleProductImage: HTMLImageElement | null = null;
  let loadedTemplatePath = '';
  let loadedSaleImageSrc = '';
  let fontLoaded = false;
  let barcodeFontLoaded = false;
  
  // Canvas dimensions (11x8.5 inches at 300dpi, landscape orientation)
  const dpi = 300;
  const width = 11 * dpi;
  const height = 8.5 * dpi;

  // Calculate scale factor compared to previous 72dpi
  const scaleFactor = dpi / 72;
  
  // Load font and setup canvas
  onMount(async () => {
    if (!browser) return;
    
    // Load Montserrat font
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap';
    document.head.appendChild(link);

    // Load Libre Barcode 39 (Code 39 barcode font)
    const barcodeLink = document.createElement('link');
    barcodeLink.rel = 'stylesheet';
    barcodeLink.href = 'https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap';
    document.head.appendChild(barcodeLink);
    
    // Wait for fonts to load
    await document.fonts.ready;
    
    // Check if Montserrat is available
    if (document.fonts.check('bold 16px Montserrat')) {
      fontLoaded = true;
    } else {
      console.warn('Montserrat font not available, using system fonts');
      fontLoaded = true; // Still proceed with drawing
    }

    // Check if Libre Barcode 39 is available
    if (document.fonts.check('16px "Libre Barcode 39"')) {
      barcodeFontLoaded = true;
    } else {
      // Force-load by measuring a test character, then re-check
      try {
        await document.fonts.load('40px "Libre Barcode 39"');
        barcodeFontLoaded = true;
      } catch (e) {
        console.warn('Libre Barcode 39 font not available');
      }
    }
    
    // Setup canvas context
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    loadTemplateImage(templatePath);
    if (saleImageSrc) {
      loadSaleProductImage(saleImageSrc);
    }
  });
  
  // Update canvas when props change
  afterUpdate(() => {
    if (!browser) return;
    if (!ctx || !fontLoaded) return;

    if (templatePath !== loadedTemplatePath) {
      loadTemplateImage(templatePath);
      return;
    }

    if (saleImageSrc !== loadedSaleImageSrc) {
      loadSaleProductImage(saleImageSrc);
      return;
    }

    if (templateImage) {
      drawCanvas();
    }
  });

  function loadTemplateImage(path: string) {
    const img = new Image();
    img.onload = () => {
      templateImage = img;
      loadedTemplatePath = path;
      drawCanvas();
    };
    img.src = path;
  }

  function loadSaleProductImage(src: string) {
    if (!src) {
      saleProductImage = null;
      loadedSaleImageSrc = '';
      drawCanvas();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      saleProductImage = img;
      loadedSaleImageSrc = src;
      drawCanvas();
    };
    img.onerror = () => {
      saleProductImage = null;
      loadedSaleImageSrc = src;
      drawCanvas();
    };
    img.src = src;
  }

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
    if (!ctx || !templateImage) return;
    
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
    
    // Title position constants
    const titleX = width / 2;
    const titleY = height / 4.8;

    const priceBoxWidth = 3128;
    const priceBoxHeight = 832;

    if (useSaleImageTemplate) {
      // 1. Draw image area (white bg + product image, clipped to cell)
      drawSaleImage(ctx, priceBoxWidth, priceBoxHeight);
      // 2. Re-stamp the template top band so the red section layers above the product image
      const topBand = Math.round(height * 0.38);
      ctx.drawImage(templateImage, 0, 0, width, topBand, 0, 0, width, topBand);
    }

    // 3. Draw title text — after image so it is always on top
    ctx.font = `bold ${calculatedTitleFontSize}pt Montserrat, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '2px';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 10 * scaleFactor;
    ctx.fillStyle = 'white';
    wrapText(ctx, title, titleX, titleY, titleBoxWidth, calculatedTitleFontSize * 1.2, 2);

    if (useSaleImageTemplate) {
      // 4. Draw price text on top of image area
      drawSalePrices(ctx, priceBoxWidth, priceBoxHeight);
    } else {
      // Default template price rendering.
      const maxPriceFontSize = Math.round(160 * scaleFactor);
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

      const priceX = width / 2;
      const priceY = height * 2/3;

      ctx.fillStyle = 'black';
      ctx.fillText(price, priceX, priceY);
    }
    
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
    
    const barcodeMarginX = Math.round(40 * scaleFactor);
    const barcodeMarginY = Math.round(10 * scaleFactor);

    if (showBarcode) {
      // "With UPC" layout:
      // - SKU label right-aligned just above the barcode
      // - Code 39 barcode in bottom-right corner
      const barcodeFontSize = Math.round(48 * scaleFactor);

      // Measure barcode height to position SKU label above it
      ctx.font = `${barcodeFontSize}pt "Libre Barcode 39"`;
      const barcodeMetrics = ctx.measureText(`*${sku.toUpperCase()}*`);
      const barcodeHeight = barcodeMetrics.actualBoundingBoxAscent + barcodeMetrics.actualBoundingBoxDescent;

      // Draw SKU label above the barcode
      ctx.font = `bold ${skuFontSize}pt Montserrat, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'black';
      const labelGap = Math.round(8 * scaleFactor);
      const skuLabelY = height - 340 * scaleFactor;
      ctx.fillText(sku.toUpperCase(), width/2, skuLabelY);

      // Draw barcode
      if (barcodeFontLoaded) {
        ctx.font = `${barcodeFontSize}pt "Libre Barcode 39"`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'black';
        ctx.fillText(`*${sku.toUpperCase()}*`, width - barcodeMarginX, height - barcodeMarginY);
      }

      // Draw optional instructional text right-justified just above the barcode
      if (instructionalText.trim()) {
        const instructionalFontSize = Math.round(14 * scaleFactor);
        ctx.font = `bold ${instructionalFontSize}pt Montserrat, Arial, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = instructionalTextColor;
        const instructionalGap = Math.round(25 * scaleFactor);
        ctx.fillText(instructionalText.toUpperCase(), width - barcodeMarginX, height - barcodeMarginY - barcodeHeight - instructionalGap);
      }
    } else {
      // Default layout: SKU text only, bottom-right corner
      ctx.font = `bold ${skuFontSize}pt Montserrat, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'black';
      ctx.fillText(sku.toUpperCase(), width/2, height - 30 * scaleFactor);
    }
  }

  // Draws the white background and product image for the sale template (left 60% area).
  // Clipped to the image cell so a scaled-up image doesn't bleed outside.
  function drawSaleImage(ctx: CanvasRenderingContext2D, boxWidth: number, boxHeight: number) {
    const areaX = (width - boxWidth) / 2;
    const areaY = (height * 2 / 3) - (boxHeight / 2);
    const imageWidth = Math.round(boxWidth * 0.6);
    const imageX = areaX;
    const imageY = areaY;
    const imageHeight = boxHeight;

    // Expand the image cell 25% outward in all directions without moving other elements
    const expandX = imageWidth * 0.25;
    const expandY = imageHeight * 0.25;
    const imgCellX = imageX - expandX;
    const imgCellY = imageY - expandY;
    const imgCellW = imageWidth + expandX * 2;
    const imgCellH = imageHeight + expandY * 2;

    // White background for expanded image cell
    ctx.fillStyle = 'white';
    ctx.fillRect(imgCellX, imgCellY, imgCellW, imgCellH);

    if (saleProductImage) {
      const padding = Math.round(24 * scaleFactor);
      const availableW = imgCellW - (padding * 2);
      const availableH = imgCellH - (padding * 2);
      // Apply user scale on top of the fit-to-cell scale, using cell center as origin
      const fitScale = Math.min(availableW / saleProductImage.width, availableH / saleProductImage.height) * saleImageScale;
      const drawW = saleProductImage.width * fitScale;
      const drawH = saleProductImage.height * fitScale;
      const drawX = imgCellX + ((imgCellW - drawW) / 2);
      const drawY = imgCellY + ((imgCellH - drawH) / 2);
      // Clip to image cell so scaled-up images don't overflow
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgCellX, imgCellY, imgCellW, imgCellH);
      ctx.clip();
      ctx.drawImage(saleProductImage, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else {
      ctx.fillStyle = '#888';
      ctx.font = `bold ${Math.round(24 * scaleFactor)}pt Montserrat, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NO IMAGE', imgCellX + (imgCellW / 2), imgCellY + (imgCellH / 2));
    }
  }

  // Draws the price text (and optional crossed-out original price) for the sale template (right 40% area).
  function drawSalePrices(ctx: CanvasRenderingContext2D, boxWidth: number, boxHeight: number) {
    const areaX = (width - boxWidth) / 2;
    const areaY = (height * 2 / 3) - (boxHeight / 2);
    const imageWidth = Math.round(boxWidth * 0.6);
    const priceWidth = boxWidth - imageWidth;
    const priceX = areaX + imageWidth;
    const priceY = areaY;
    const priceHeight = boxHeight;
    const priceCenterX = priceX + (priceWidth / 2);

    const saleValue = price.trim() || '$0.00';
    const originalValue = originalPrice.trim();

    if (originalValue) {
      const maxOriginalSize = Math.round(64 * scaleFactor);
      const originalFontSize = calculateOptimalFontSize(
        ctx, originalValue, maxOriginalSize, priceWidth * 0.9, priceHeight * 0.25, 1
      );
      ctx.font = `bold ${originalFontSize}pt Montserrat, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#cc0000';
      const originalY = priceY + (priceHeight * 0.30);
      ctx.fillText(originalValue, priceCenterX, originalY);

      const textMetrics = ctx.measureText(originalValue);
      const strikeHalf = (textMetrics.width / 2) + Math.round(4 * scaleFactor);
      ctx.strokeStyle = '#cc0000';
      ctx.lineWidth = Math.max(2, Math.round(6 * scaleFactor));
      ctx.beginPath();
      ctx.moveTo(priceCenterX - strikeHalf, originalY);
      ctx.lineTo(priceCenterX + strikeHalf, originalY);
      ctx.stroke();

      const maxSaleSize = Math.round(144 * scaleFactor);
      const saleFontSize = calculateOptimalFontSize(
        ctx, saleValue, maxSaleSize, priceWidth * 0.95, priceHeight * 0.5, 1
      );
      ctx.font = `bold ${saleFontSize}pt Montserrat, Arial, sans-serif`;
      ctx.fillStyle = 'black';
      ctx.fillText(saleValue, priceCenterX, priceY + (priceHeight * 0.73));
      return;
    }

    const maxPriceSize = Math.round(160 * scaleFactor);
    const priceFontSize = calculateOptimalFontSize(
      ctx, saleValue, maxPriceSize, priceWidth * 0.95, priceHeight * 0.9, 1
    );
    ctx.font = `bold ${priceFontSize}pt Montserrat, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'black';
    ctx.fillText(saleValue, priceCenterX, priceY + (priceHeight / 2));
  }
</script>

<svelte:head>
  <!-- Preload the font to ensure it's available -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
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
