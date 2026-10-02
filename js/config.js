/* ============================================================
   AUTH CONFIG
   Вход через Firebase Auth. Пароли и их хэши здесь не хранятся.
   ============================================================ */

window.AUTH_CONFIG = {
  ownerEmail: 'nedomolkin.1998@mail.ru' /* твой email для Firebase Auth */
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


/* ============================================================
   APP CONFIG — лимит бесплатных мест и поддержка
   ============================================================ */
window.APP_CONFIG = {
  freeUsersLimit: 1000,                      /* сколько бесплатных регистраций */
  supportUrl: 'https://t.me/help_youvsyou',  /* бот техподдержки */
  aiChatUrl: 'https://functions.yandexcloud.net/d4e4ecjf3t2avrtehojj',                             /* адрес облачной функции Yandex Cloud для чата с AI-тренером */
  aiChatLimit: 20                            /* бесплатных сообщений в месяц */
};
