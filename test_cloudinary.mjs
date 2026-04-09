import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dcivcevmh',
  api_key: '769967281487747',
  api_secret: '-zDoKCouvEzS_hfGNFeBenl5UWE',
  secure: true,
});

const publicId = 'farmacologia-materiais/materials/1774825817727-wwnlaq1f-teste.pdf';

// Approach 1: signed URL
const url1 = cloudinary.url(publicId, {
  resource_type: 'raw',
  secure: true,
  sign_url: true,
  type: 'upload',
});
console.log('Signed URL:', url1);

// Approach 2: signed URL with auth token
const url2 = cloudinary.url(publicId, {
  resource_type: 'raw',
  secure: true,
  sign_url: true,
  type: 'authenticated',
});
console.log('Authenticated URL:', url2);

// Approach 3: Try generating download URL via API
try {
  const result = await cloudinary.api.resource(publicId, { resource_type: 'raw' });
  console.log('Resource info:', JSON.stringify(result, null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
