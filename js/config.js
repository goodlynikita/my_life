/* ============================================================
   AUTH CONFIG
   Owner password: 2603199
   Coach password: 1234
   To change a password later: open generate-hash.html, type the
   new password, copy the hash, paste it here instead of the old
   one, then save this file back to the repo.
   ============================================================ */

window.AUTH_CONFIG = {
  ownerHash: 'c7330ec97ead741e884e1b9ea992a4d041bf45fb3bd6ef1208a139728f677e71',
  coachHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
};

/* ============================================================
   FIREBASE CONFIG
   Полный конфиг проекта nik-track для официального Firebase SDK.
   Этот объект используется firebase-sync.js напрямую через SDK,
   а не через самописный fetch к REST API.
   ============================================================ */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCYu9GKmo8Yuj0mWpZ31Exz01_cpjKW8mU",
  authDomain: "nik-track.firebaseapp.com",
  databaseURL: "https://nik-track-default-rtdb.firebaseio.com",
  projectId: "nik-track",
  storageBucket: "nik-track.firebasestorage.app",
  messagingSenderId: "736205367588",
  appId: "1:736205367588:web:3c0759060b677d3e2aebb1"
};

