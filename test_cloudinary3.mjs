import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dcivcevmh',
  api_key: '769967281487747',
  api_secret: '-zDoKCouvEzS_hfGNFeBenl5UWE',
  secure: true,
});

const publicId = 'farmacologia-materiais/materials/1774825817727-wwnlaq1f-teste.pdf';

// The issue is that the account has "Signed URLs only" enabled
// This means ALL raw files need signed URLs
// But the signed URL format might need to be different

// Try downloading via Admin API - get the content directly
try {
  // Use the Admin API to get the resource, then use the secure_url
  const resource = await cloudinary.api.resource(publicId, { resource_type: 'raw' });
  console.log('secure_url:', resource.secure_url);
  
  // Try fetching with the API key/secret as basic auth
  const basicAuth = Buffer.from('769967281487747:-zDoKCouvEzS_hfGNFeBenl5UWE').toString('base64');
  
  // Method 1: Direct fetch of secure_url
  let resp = await fetch(resource.secure_url);
  console.log('Direct fetch status:', resp.status);
  
  // Method 2: With cookie/token auth
  resp = await fetch(resource.secure_url, {
    headers: { 'Authorization': `Basic ${basicAuth}` }
  });
  console.log('Basic auth fetch status:', resp.status);
  
  // Method 3: Try the download endpoint from Admin API
  // https://api.cloudinary.com/v1_1/{cloud}/resources/{resource_type}/{type}/{public_id}
  // This returns metadata, not the file itself
  
  // Method 4: Try creating a zip archive with the file
  // cloudinary.v2.utils.download_zip_url
  const zipUrl = cloudinary.utils.download_zip_url({
    public_ids: [publicId],
    resource_type: 'raw',
  });
  console.log('Zip URL:', zipUrl);
  
  resp = await fetch(zipUrl);
  console.log('Zip fetch status:', resp.status);
  if (resp.ok) {
    const buf = await resp.arrayBuffer();
    console.log('Zip size:', buf.byteLength);
  } else {
    const text = await resp.text();
    console.log('Zip error:', text.substring(0, 200));
  }
  
} catch(e) {
  console.error('Error:', e.message);
}
