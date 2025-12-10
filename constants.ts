// Images
// 주의: 아래 파일들은 프로젝트 루트의 'public' 폴더 안에 위치해야 합니다.
// Vercel 배포 시 public 폴더의 파일은 '/'로 시작하는 절대 경로로 접근해야 가장 안전합니다.
export const BG_IMAGE = '/santa_village_background.png';
export const SOCK_IMAGE = '/socks.png';

// Generate paths for gifts 1 to 35
export const getGiftImage = (id: number) => `/${id}.png`;

// Configuration
export const TOTAL_SOCKS = 35;
export const DRUMROLL_DURATION = 3000; // ms

// Sound Resources
export const SOUNDS = {
  DRUMROLL: '/drum.mp3', 
  TADA: '/ding.mp3',
  BGM: '/bgm.mp3'
};
