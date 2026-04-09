import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dcivcevmh',
  api_key: '769967281487747',
  api_secret: '-zDoKCouvEzS_hfGNFeBenl5UWE',
  secure: true,
});

const publicId = 'farmacologia-materiais/materials/1774825817727-wwnlaq1f-teste.pdf';

// Method: Use download_backedup_asset or download_folder
// Actually, let's try the simplest approach: 
// Use the Admin API to create a temporary download URL

// The download_zip_url works! Let's use it for single files
// But we need the actual file, not a zip

// Alternative: Use cloudinary.utils.download_zip_url with flatten_folders
const zipUrl = cloudinary.utils.download_zip_url({
  public_ids: [publicId],
  resource_type: 'raw',
  flatten_folders: true,
});
console.log('Zip URL:', zipUrl);

// Download the zip and extract
const resp = await fetch(zipUrl);
if (resp.ok) {
  const buf = Buffer.from(await resp.arrayBuffer());
  // Save the zip to check contents
  const fs = await import('fs');
  fs.writeFileSync('/tmp/test_download.zip', buf);
  console.log('Saved zip, size:', buf.length);
  
  // Check if we can use the API to get a direct download URL
  // Try: cloudinary.utils.api_sign_request for a custom download
}

// Alternative approach: Use cloudinary.api.resource with content_type
// to get a downloadable URL
try {
  // Try the download API endpoint directly
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    public_id: publicId,
    resource_type: 'raw',
    type: 'upload',
    timestamp: timestamp,
  };
  
  // Sign the request
  const signature = cloudinary.utils.api_sign_request(params, '-zDoKCouvEzS_hfGNFeBenl5UWE');
  console.log('Signature:', signature);
  
  // Try the content endpoint
  const contentUrl = `https://api.cloudinary.com/v1_1/dcivcevmh/resources/raw/upload/${encodeURIComponent(publicId)}?timestamp=${timestamp}&signature=${signature}&api_key=769967281487747`;
  console.log('Content URL:', contentUrl);
  
  const contentResp = await fetch(contentUrl);
  console.log('Content status:', contentResp.status);
  if (contentResp.ok) {
    const data = await contentResp.json();
    console.log('Content data:', JSON.stringify(data).substring(0, 300));
  }
} catch(e) {
  console.error('Error:', e.message);
}
