import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia.'
  );
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const updates = [
  {
    oldEmail: 'customer.demo@freshlaundry.test',
    newEmail: 'sleephousecrb@gmail.com',
  },
  {
    oldEmail: 'owner.demo@freshlaundry.test',
    newEmail: 'sleephouseklayan@gmail.com',
  },
  {
    oldEmail: 'courier.demo@freshlaundry.test',
    newEmail: 'laraswatibestari6@gmail.com',
  },
  {
    oldEmail: 'admin.demo@freshlaundry.test',
    newEmail: 'Kurnia123@gmail.com',
  },
];

async function main() {
  for (const item of updates) {
    console.log(`Updating ${item.oldEmail} → ${item.newEmail}`);

    const { data: users, error: listError } =
      await supabase.auth.admin.listUsers();

    if (listError) {
      throw listError;
    }

    const user = users.users.find(
      (u) => u.email?.toLowerCase() === item.oldEmail.toLowerCase()
    );

    if (!user) {
      throw new Error(`User tidak ditemukan: ${item.oldEmail}`);
    }

    const { error } =
      await supabase.auth.admin.updateUserById(
        user.id,
        {
          email: item.newEmail,
          email_confirm: false,
        }
      );

    if (error) {
      throw error;
    }

    console.log(`✓ Updated: ${user.id}`);
  }

  console.log('Semua email Auth berhasil diperbarui.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});