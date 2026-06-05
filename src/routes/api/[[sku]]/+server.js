/**
 * Server-side API endpoint to fetch product data from Angeles Millwork
 * This avoids CORS issues by making the request from the server
 */
export async function GET({ params }) {
  const { sku } = params;
  
  // If no SKU provided, return error
  if (!sku) {
    return new Response(
      JSON.stringify({ success: false, error: 'No SKU provided' }), 
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  try {
    // Use an inline query with the 'in' filter — Magento's 'eq' filter resolves to
    // the configurable parent only, while 'in' returns all matching items (parent
    // + simple children) so we can pick the exact SKU match server-side.
    const skuSafe = sku.replace(/"/g, '');
    const inlineQuery = `{ products(pageSize: 775, filter: { sku: { in: ["${skuSafe}"] } }) { items { id sku name description { html } price_range { minimum_price { regular_price { value currency } final_price { value currency } discount { amount_off percent_off } } maximum_price { regular_price { value currency } final_price { value currency } discount { amount_off percent_off } } } media_gallery { url label position disabled } } } }`;

    // Fetch data from Magento GraphQL endpoint
    const response = await fetch('https://angelesmillwork.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: inlineQuery }),
    });
    
    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Network error: ${response.status} ${response.statusText}` 
        }), 
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const result = await response.json();
    
    // Check for GraphQL errors
    if (result.errors) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.errors[0].message || 'GraphQL error occurred' 
        }), 
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Check if we got product data
    if (!result.data?.products?.items?.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No product found with SKU: ${sku}` 
        }), 
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Filter to exact SKU match — configurable parents may also appear in results
    const exactMatch = result.data.products.items.find(
      (item) => item.sku?.toLowerCase() === sku.toLowerCase()
    );

    if (!exactMatch) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No product found with SKU: ${sku}` 
        }), 
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Return the product data
    return new Response(
      JSON.stringify({ 
        success: true, 
        product: exactMatch 
      }), 
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Error fetching product:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
