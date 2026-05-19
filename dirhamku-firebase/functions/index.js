const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

// ============================================================
// AUTO-CLEANUP: Hapus semua data user ketika akun dihapus
// ============================================================
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  console.log(`Cleaning up data for deleted user: ${uid}`);

  try {
    const userRef = db.collection("users").doc(uid);

    // Delete all transactions (subcollection)
    const txSnapshot = await userRef.collection("transactions").get();
    if (!txSnapshot.empty) {
      const batches = [];
      let batch = db.batch();
      let count = 0;

      txSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
        if (count >= 450) {
          batches.push(batch.commit());
          batch = db.batch();
          count = 0;
        }
      });

      if (count > 0) batches.push(batch.commit());
      await Promise.all(batches);
    }

    // Delete user profile document
    await userRef.delete();
    console.log(`Successfully cleaned up data for user: ${uid}`);
  } catch (error) {
    console.error(`Error cleaning up user ${uid}:`, error);
  }
});

// ============================================================
// CALLABLE: Export data user (untuk backup)
// ============================================================
exports.exportUserData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login diperlukan.");
  }

  const uid = context.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const profile = userDoc.exists ? userDoc.data() : {};

    const txSnapshot = await db
      .collection("users").doc(uid)
      .collection("transactions").orderBy("date").get();

    const transactions = [];
    txSnapshot.forEach((doc) => {
      const d = doc.data();
      transactions.push({
        id: doc.id,
        date: d.date ? d.date.toDate().toISOString().split("T")[0] : "",
        type: d.type,
        category: d.category,
        amount: d.amount,
        note: d.note || "",
      });
    });

    return {
      ok: true,
      profile: {
        email: profile.email || "",
        displayName: profile.displayName || "",
        monthlyBudget: profile.monthlyBudget || 3000000,
      },
      transactions: transactions,
      exportedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});
