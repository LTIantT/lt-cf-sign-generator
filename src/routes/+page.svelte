<script lang="ts">
  import CanvasPreview from '$lib/components/CanvasPreview.svelte';
  
  // Form state
  let title = 'Product Name';
  let price = '$9.99';
  let sku = 'ABC123';
  let templatePath = '/img/template.jpg';
  // New state for custom title font size
  let titleFontSize: number | null = null;
  
  // Status state for API requests
  let isLoading = false;
  let errorMessage = '';
  let successMessage = '';
  
  // Available templates (you can expand this list)
  const templates = [
    { name: 'Default Template', path: '/img/template.jpg' },
    // Add more templates as needed
  ];
  
  // Handle form submission (e.g., for saving/printing)
  function handleSubmit() {
    // Implement your save/export logic here
    console.log('Form submitted with:', { title, price, sku, templatePath });
  }
  
  // Function to lookup SKU in Magento via our server-side API
  async function lookupSku() {
    if (!sku.trim()) {
      errorMessage = 'Please enter a SKU';
      return;
    }
    
    // Reset messages
    errorMessage = '';
    successMessage = '';
    isLoading = true;
    
    try {
      // Call our server-side API instead of Magento directly
      const response = await fetch(`/api/${encodeURIComponent(sku)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch product data');
      }
      
      // Extract product data
      const product = result.product;
      const productPrice = product.price_range.minimum_price.regular_price;
      
      // Update form values
      title = product.name;
      price = `$${productPrice.value.toFixed(2)}`;
      
      // Show success message
      successMessage = 'Product information loaded successfully!';
      
    } catch (error) {
      console.error('Error fetching product:', error);
      errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    } finally {
      isLoading = false;
    }
  }

  // Reset form to defaults
  function resetForm() {
    title = 'Product Name';
    price = '$9.99';
    sku = 'ABC123';
    templatePath = templates[0].path;
    titleFontSize = null; // Reset to auto font size
    errorMessage = '';
    successMessage = '';
  }
</script>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="container mx-auto px-4">
    <h1 class="text-3xl font-bold text-center mb-8">Sign Generator</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Form Column -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <form on:submit|preventDefault={handleSubmit} class="space-y-6">
          {#if errorMessage}
            <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <!-- Error icon -->
                  <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-red-700">{errorMessage}</p>
                </div>
              </div>
            </div>
          {/if}
          
          {#if successMessage}
            <div class="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <!-- Success icon -->
                  <svg class="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-green-700">{successMessage}</p>
                </div>
              </div>
            </div>
          {/if}
          
          <div>
            <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <div class="flex gap-2 items-end">
              <div class="flex-1">
              <input
                id="title"
                type="text"
                bind:value={title}
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter product title"
              />
              </div>
              <div class="w-24">
              <label for="titleFontSize" class="block text-xs font-medium text-gray-700 mb-1">
                Font Size
              </label>
              <input
                id="titleFontSize"
                type="number"
                bind:value={titleFontSize}
                min="1"
                max="312"
                placeholder="Auto"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              </div>
            </div>
            </div>
            <div class="flex justify-between mt-1">
              <p class="text-xs text-gray-500">
                This will appear in white with a black outline (max 2 lines)
              </p>
              {#if titleFontSize !== null}
                <button
                  type="button"
                  class="text-xs text-indigo-600 hover:text-indigo-800"
                  on:click={() => titleFontSize = null}
                >
                  Reset to auto
                </button>
              {/if}
            </div>
          
          <div>
            <label for="price" class="block text-sm font-medium text-gray-700 mb-1">
              Price
            </label>
            <input
              id="price"
              type="text"
              bind:value={price}
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="$0.00"
            />
            <p class="mt-1 text-xs text-gray-500">
              This will appear in large black text
            </p>
          </div>
          
          <div>
            <label for="sku" class="block text-sm font-medium text-gray-700 mb-1">
              SKU
            </label>
            <div class="flex">
              <input
                id="sku"
                type="text"
                bind:value={sku}
                class="flex-1 px-3 py-2 border border-r-0 border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter SKU"
              />
              <button
                type="button"
                class="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                on:click={lookupSku}
                disabled={isLoading}
              >
                {#if isLoading}
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                {:else}
                  <svg class="h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                {/if}
                <span class="ml-1">Lookup</span>
              </button>
            </div>
            <p class="mt-1 text-xs text-gray-500">
              Enter a SKU and click Lookup to fetch product details from Angeles Millwork
            </p>
          </div>
          
          <div>
            <label for="template" class="block text-sm font-medium text-gray-700 mb-1">
              Template
            </label>
            <select
              id="template"
              bind:value={templatePath}
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              {#each templates as template}
                <option value={template.path}>{template.name}</option>
              {/each}
            </select>
          </div>
          
          <div class="flex gap-4">
            <button
              type="submit"
              class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Generate Sign
            </button>
            
            <button
              type="button"
              class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              on:click={resetForm}
            >
              Reset
            </button>
          </div>
      </div>
      
      <!-- Preview Column -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-lg font-medium text-gray-800 mb-4">Preview</h2>
        <CanvasPreview {title} {price} {sku} {templatePath} {titleFontSize} />
      </div>
    </div>
  </div>
</div>
