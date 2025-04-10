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
    // GraphQL query to fetch product data
    const query = `
      query GetProductBySku($sku: String!) {
        products(filter: { sku: { eq: $sku } }) {
          items {
            name
            sku
            price_range {
              minimum_price {
                regular_price {
                  value
                  currency
                }
              }
            }
          }
        }
      }
    `;
    
    // Variables for the query
    const variables = { sku };
    
    // Fetch data from Magento GraphQL endpoint
    const response = await fetch('https://angelesmillwork.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
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
    
    // Return the product data
    return new Response(
      JSON.stringify({ 
        success: true, 
        product: result.data.products.items[0] 
      }), 
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Error fetching product:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An unknown error occurred' 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
