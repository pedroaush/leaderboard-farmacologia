import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dcivcevmh',
  api_key: '769967281487747',
  api_secret: '-zDoKCouvEzS_hfGNFeBenl5UWE',
  secure: true,
});

const publicId = 'farmacologia-materiais/materials/1774825817727-wwnlaq1f-teste.pdf';

// Try with long URL signature
const url1 = cloudinary.url(publicId, {
  resource_type: 'raw',
  secure: true,
  sign_url: true,
  type: 'upload',
  long_url_signature: true,
});
console.log('Long signed URL:', url1);

// Try with fl_attachment
const url2 = cloudinary.url(publicId, {
  resource_type: 'raw',
  secure: true,
  sign_url: true,
  type: 'upload',
  flags: 'attachment',
});
console.log('Attachment URL:', url2);

// Try with specific version
const url3 = cloudinary.url(publicId, {
  resource_type: 'raw',
  secure: true,
  sign_url: true,
  type: 'upload',
  version: 1774825818,
});
console.log('Versioned URL:', url3);

// Check security settings
try {
  const settings = await cloudinary.api.root_folders();
  console.log('Folders:', JSON.stringify(settings));
} catch(e) {
  console.log('Folders error:', e.message);
}

// Try to check if strict transformations is enabled
try {
  const usage = await cloudinary.api.usage();
  console.log('Usage:', JSON.stringify(usage, null, 2).substring(0, 500));
} catch(e) {
  console.log('Usage error:', e.message);
}
