import bcrypt from 'bcrypt';

async function generateHashes() {
  const hash1 = await bcrypt.hash('password', 10);
  const hash2 = await bcrypt.hash('password', 10);

  console.log('\nPaste this into init.sql:\n');
  console.log('INSERT INTO users (username, password_hash) VALUES');
  console.log(`('user1', '${hash1}'),`);
  console.log(`('user2', '${hash2}')`);
  console.log('ON DUPLICATE KEY UPDATE username=username;\n');
}

generateHashes();
