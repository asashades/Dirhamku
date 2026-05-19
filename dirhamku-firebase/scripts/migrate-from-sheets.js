/**
 * ============================================================
 * DIRHAMKU - Migration Script
 * Migrate data from Google Sheets CSV export to Firebase Firestore
 * ============================================================
 * 
 * CARA PAKAI:
 * 1. Buka Google Sheets → File → Download → CSV (.csv)
 * 2. Simpan file CSV di folder scripts/ dengan nama "data.csv"
 * 3. Pastikan sudah setup Firebase Admin SDK:
 *    - Buka Firebase Console → Project Settings → Service Accounts
 *    - Generate New Private Key → simpan sebagai "serviceAccountKey.json" di folder scripts/
 * 4. Jalankan: node scripts/migrate-from-sheets.js <USER_UID>
 * 
 * Format CSV yang diharapkan (sesuai Google Sheets Dirhamku):
 * Date, Type, Category, Amount, Note
 * 2026-01-15, Expense, Food, 50000, Makan siang
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIG
// ============================================================
const CSV_FILE = path.join(__dirname, 'data.csv');
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'serviceAccountKey.json');

// Get target user UID from command line
const TARGET_USER_UID = process.argv[2];

if (!TARGET_USER_UID) {
    console.error('\n❌ ERROR: User UID diperlukan.');
    console.error('   Cara pakai: node scripts/migrate-from-sheets.js <USER_UID>');
    console.error('   Contoh:     node scripts/migrate-from-sheets.js abc123def456\n');
    console.error('   Untuk mendapatkan UID:');
    console.error('   - Buka Firebase Console → Authentication → Users');
    console.error('   - Copy UID user yang ingin dimigrasi datanya\n');
    process.exit(1);
}

if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    console.error('\n❌ ERROR: File serviceAccountKey.json tidak ditemukan.');
    console.error('   Download dari Firebase Console → Project Settings → Service Accounts\n');
    process.exit(1);
}

if (!fs.existsSync(CSV_FILE)) {
    console.error('\n❌ ERROR: File data.csv tidak ditemukan.');
    console.error('   Export dari Google Sheets → File → Download → CSV');
    console.error(`   Simpan di: ${CSV_FILE}\n`);
    process.exit(1);
}

// ============================================================
// INIT FIREBASE ADMIN
// ============================================================
const serviceAccount = require(SERVICE_ACCOUNT_FILE);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// ============================================================
// PARSE CSV
// ============================================================
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length <= 1) {
        console.error('❌ File CSV kosong atau hanya header.');
        process.exit(1);
    }

    // Skip header row
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    console.log(`📋 Header CSV: ${header.join(', ')}`);
    
    const transactions = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length < 4) {
            console.warn(`⚠️  Baris ${i + 1} dilewati (kolom kurang): ${lines[i]}`);
            continue;
        }

        const dateStr = values[0];
        const type = values[1];
        const category = values[2];
        const amount = parseFloat(values[3]);
        const note = values.slice(4).join(',').trim(); // Handle notes with commas

        // Validate
        if (!dateStr || isNaN(amount) || amount <= 0) {
            console.warn(`⚠️  Baris ${i + 1} dilewati (data invalid): ${lines[i]}`);
            continue;
        }

        if (!['Income', 'Expense'].includes(type)) {
            console.warn(`⚠️  Baris ${i + 1} dilewati (type bukan Income/Expense): ${type}`);
            continue;
        }

        // Parse date to local midnight
        const dateParts = dateStr.split(/[-\/]/);
        let date;
        if (dateParts.length === 3) {
            // Try YYYY-MM-DD first, then MM/DD/YYYY
            if (dateParts[0].length === 4) {
                date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
            } else {
                date = new Date(parseInt(dateParts[2]), parseInt(dateParts[0]) - 1, parseInt(dateParts[1]));
            }
        } else {
            date = new Date(dateStr);
        }

        if (isNaN(date.getTime())) {
            console.warn(`⚠️  Baris ${i + 1} dilewati (tanggal invalid): ${dateStr}`);
            continue;
        }

        transactions.push({ date, type, category, amount, note });
    }

    return transactions;
}

// ============================================================
// MIGRATE TO FIRESTORE
// ============================================================
async function migrate() {
    console.log('\n🚀 DIRHAMKU - Migrasi Data ke Firebase Firestore');
    console.log('================================================\n');
    console.log(`📁 File CSV: ${CSV_FILE}`);
    console.log(`👤 Target User UID: ${TARGET_USER_UID}\n`);

    // Parse CSV
    const transactions = parseCSV(CSV_FILE);
    console.log(`✅ ${transactions.length} transaksi ditemukan.\n`);

    if (transactions.length === 0) {
        console.log('❌ Tidak ada transaksi untuk dimigrasi.');
        process.exit(0);
    }

    // Confirm
    console.log('📊 Preview 5 transaksi pertama:');
    transactions.slice(0, 5).forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.date.toISOString().split('T')[0]} | ${tx.type} | ${tx.category} | Rp ${tx.amount.toLocaleString()} | ${tx.note}`);
    });
    console.log('');

    // Batch write to Firestore
    const userRef = db.collection('users').doc(TARGET_USER_UID);
    const txCollection = userRef.collection('transactions');

    let batchCount = 0;
    let totalWritten = 0;
    let batch = db.batch();

    for (const tx of transactions) {
        const docRef = txCollection.doc();
        batch.set(docRef, {
            date: admin.firestore.Timestamp.fromDate(tx.date),
            type: tx.type,
            category: tx.category,
            amount: tx.amount,
            note: tx.note,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchCount++;
        totalWritten++;

        // Firestore batch limit is 500
        if (batchCount >= 450) {
            process.stdout.write(`   ✏️  Menulis batch... (${totalWritten}/${transactions.length})\r`);
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
    }

    console.log(`\n✅ BERHASIL! ${totalWritten} transaksi telah dimigrasi ke Firestore.`);
    console.log(`   Collection: users/${TARGET_USER_UID}/transactions\n`);
    
    // Summary
    const incomeCount = transactions.filter(t => t.type === 'Income').length;
    const expenseCount = transactions.filter(t => t.type === 'Expense').length;
    const totalIncome = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);

    console.log('📊 Ringkasan:');
    console.log(`   Pemasukan:    ${incomeCount} transaksi (Rp ${totalIncome.toLocaleString()})`);
    console.log(`   Pengeluaran:  ${expenseCount} transaksi (Rp ${totalExpense.toLocaleString()})`);
    console.log(`   Saldo:        Rp ${(totalIncome - totalExpense).toLocaleString()}\n`);

    process.exit(0);
}

migrate().catch(err => {
    console.error('\n❌ Error saat migrasi:', err.message);
    process.exit(1);
});
