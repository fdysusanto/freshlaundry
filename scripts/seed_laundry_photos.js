const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach((line) => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SOURCE_PHOTOS = [
  {
    slot: 0,
    title: 'Storefront',
    url: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=1200&q=80',
    photographer: 'Timmy Henny',
  },
  {
    slot: 1,
    title: 'Interior',
    url: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=1200&q=80',
    photographer: 'Jonathan Borba',
  },
  {
    slot: 2,
    title: 'Washing Machine',
    url: 'https://images.unsplash.com/photo-1521656693074-0ef32e80a5d5?auto=format&fit=crop&w=1200&q=80',
    photographer: 'Planet Volumes',
  },
  {
    slot: 3,
    title: 'Service Area',
    url: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?auto=format&fit=crop&w=1200&q=80',
    photographer: 'Waldemar',
  },
  {
    slot: 4,
    title: 'Laundry Operation',
    url: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=1200&q=80',
    photographer: 'Nick Page',
  },
];

async function seedPhotos() {
  console.log('=== STARTING LAUNDRY PHOTO SEEDING ===');

  // 1. Find target laundry in DB
  const { data: laundries, error: laundryErr } = await supabase
    .from('laundries')
    .select('id, name, code')
    .limit(10);

  if (laundryErr || !laundries || laundries.length === 0) {
    console.error('Gagal mengambil data laundry:', laundryErr?.message);
    process.exit(1);
  }

  // Find Laundry Test Cirebon or first laundry
  const targetLaundry = laundries.find((l) => l.name.includes('Cirebon')) || laundries[0];
  console.log(`Target Laundry ID: ${targetLaundry.id}`);
  console.log(`Target Laundry Name: ${targetLaundry.name} (${targetLaundry.code})`);

  // 2. Check existing photos for target laundry
  const { data: existingPhotos } = await supabase
    .from('laundry_photos')
    .select('*')
    .eq('laundry_id', targetLaundry.id);

  if (existingPhotos && existingPhotos.length >= 5) {
    console.log(`Mitra ${targetLaundry.name} sudah memiliki ${existingPhotos.length} foto profil di DB.`);
    console.log(existingPhotos);
    return;
  }

  // 3. Ensure bucket 'laundry-photos' exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets && buckets.some((b) => b.name === 'laundry-photos');

  if (!bucketExists) {
    console.log("Creating public bucket 'laundry-photos'...");
    const { error: createBucketErr } = await supabase.storage.createBucket('laundry-photos', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      fileSizeLimit: 5242880,
    });
    if (createBucketErr) {
      console.warn('Bucket creation warning (may already exist):', createBucketErr.message);
    }
  }

  // 4. Download and upload each photo
  const uploadedRecords = [];
  const uploadedStoragePaths = [];

  try {
    for (const item of SOURCE_PHOTOS) {
      console.log(`Downloading Photo slot ${item.slot} (${item.title}) by ${item.photographer}...`);
      const response = await fetch(item.url);
      if (!response.ok) {
        throw new Error(`Failed to download ${item.url}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const photoId = crypto.randomUUID();
      const storagePath = `${targetLaundry.id}/${photoId}.jpg`;

      console.log(`Uploading to storage bucket 'laundry-photos': ${storagePath}...`);
      const { error: uploadErr } = await supabase.storage
        .from('laundry-photos')
        .upload(storagePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(`Storage upload failed for ${storagePath}: ${uploadErr.message}`);
      }

      uploadedStoragePaths.push(storagePath);

      const { data: urlData } = supabase.storage
        .from('laundry-photos')
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      uploadedRecords.push({
        id: photoId,
        laundry_id: targetLaundry.id,
        storage_path: storagePath,
        public_url: publicUrl,
        photo_slot: item.slot,
        sort_order: item.slot,
        is_primary: item.slot === 0,
      });
    }

    // 5. Clean existing photos for this laundry if any (to avoid slot conflicts during seed)
    if (existingPhotos && existingPhotos.length > 0) {
      console.log('Cleaning existing incomplete photos for laundry before seed...');
      await supabase.from('laundry_photos').delete().eq('laundry_id', targetLaundry.id);
    }

    // 6. Insert all 5 records into laundry_photos table
    console.log('Inserting 5 photo records into public.laundry_photos table...');
    const { data: insertedData, error: insertErr } = await supabase
      .from('laundry_photos')
      .insert(uploadedRecords)
      .select();

    if (insertErr) {
      throw new Error(`DB Insert Error: ${insertErr.message}`);
    }

    console.log('=== SUCCESS! 5 LAUNDRY PROFILE PHOTOS UPLOADED & INSERTED ===');
    console.log(`Total Rows Inserted: ${insertedData.length}`);

    // 7. Validation verification query
    const { data: verifyData } = await supabase
      .from('laundry_photos')
      .select('*')
      .eq('laundry_id', targetLaundry.id)
      .order('photo_slot', { ascending: true });

    console.log('\n--- VERIFICATION RESULT ---');
    console.log(`Laundry ID: ${targetLaundry.id}`);
    console.log(`Laundry Name: ${targetLaundry.name}`);
    console.log(`Total DB Rows: ${verifyData.length}`);
    verifyData.forEach((row) => {
      console.log(`Slot ${row.photo_slot}: primary=${row.is_primary}, url=${row.public_url}`);
    });

  } catch (err) {
    console.error('ERROR ENCOUNTERED. CLEANING UP UPLOADED OBJECTS:', err.message);
    if (uploadedStoragePaths.length > 0) {
      await supabase.storage.from('laundry-photos').remove(uploadedStoragePaths);
      console.log('Cleaned up uploaded storage objects successfully.');
    }
    process.exit(1);
  }
}

seedPhotos();
