/**
 * Script untuk menambahkan test data untuk update checker
 * Run: node scripts/add-update-metadata.js
 */

const admin = require('firebase-admin');

// Initialize with service account or use existing config
// For local development, you may need to set GOOGLE_APPLICATION_CREDENTIALS
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'dirhamku'
  });
} catch (e) {
  console.log('App already initialized or using default credentials');
}

async function addUpdateMetadata() {
  const db = admin.firestore();

  const metadata = {
    version: '5.0',  // Ubah ke '5.1' untuk test
    is_mandatory: false,
    changelog: {
      id: 'Perbaikan bug dan peningkatan performa',
      en: 'Bug fixes and performance improvements'
    },
    min_version: null,  // Tidak ada mandatory minimum
    released_at: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('app_metadata').doc('latest_version').set(metadata);
    console.log('✅ Update metadata added successfully!');
    console.log('📦 Data:', JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('❌ Error adding metadata:', error);
  }
}

addUpdateMetadata();