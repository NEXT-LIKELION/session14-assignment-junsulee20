const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const usersCollection = db.collection("users");

// 유효성 검사 함수
function isValidName(name) {
  return !/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(name);  // 한글 포함되면 false
}
function isValidEmail(email) {
  return email.includes('@');
}

// [1] POST: 유저 등록
exports.createUser = onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { name, email } = req.body;
  if (!name || !email) return res.status(400).send({ error: 'Missing name or email' });
  if (!isValidName(name)) return res.status(400).send({ error: 'Name must not include Korean characters' });
  if (!isValidEmail(email)) return res.status(400).send({ error: 'Invalid email format' });

  try {
    const docRef = await usersCollection.add({
      name,
      email,
      createdAt: Date.now()  // timestamp 저장
    });
    return res.status(201).send({ id: docRef.id, message: 'User created' });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
});

// [2] GET: 유저 조회
exports.getUser = onRequest(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const name = req.query.name;
  if (!name) return res.status(400).send({ error: 'Missing name' });

  try {
    const snapshot = await usersCollection.where('name', '==', name).limit(1).get();
    if (snapshot.empty) return res.status(404).send({ message: 'User not found' });

    const doc = snapshot.docs[0];
    return res.status(200).send({ id: doc.id, ...doc.data() });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
});

// [3] PUT: 이메일 수정
exports.updateEmail = onRequest(async (req, res) => {
  if (req.method !== 'PUT') return res.status(405).send('Method Not Allowed');

  const name = req.query.name;
  const { email } = req.body;
  if (!name || !email) return res.status(400).send({ error: 'Missing name or email' });
  if (!isValidEmail(email)) return res.status(400).send({ error: 'Invalid email format' });

  try {
    const snapshot = await usersCollection.where('name', '==', name).limit(1).get();
    if (snapshot.empty) return res.status(404).send({ message: 'User not found' });

    const doc = snapshot.docs[0];
    await doc.ref.update({ email });
    return res.status(200).send({ message: 'Email updated' });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
});

// [4] DELETE: 가입 1분 이후에만 삭제
exports.deleteUser = onRequest(async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).send('Method Not Allowed');

  const name = req.query.name;
  if (!name) return res.status(400).send({ error: 'Missing name' });

  try {
    const snapshot = await usersCollection.where('name', '==', name).limit(1).get();
    if (snapshot.empty) return res.status(404).send({ message: 'User not found' });

    const doc = snapshot.docs[0];
    const { createdAt } = doc.data();
    const now = Date.now();
    const diffMs = now - createdAt;

    if (diffMs < 60 * 1000) {
      return res.status(403).send({ message: 'User cannot be deleted within 1 minute of creation' });
    }

    await doc.ref.delete();
    return res.status(200).send({ message: 'User deleted' });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
});
