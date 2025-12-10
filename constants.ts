// Images
export const BG_IMAGE = './santa_village_background.png';
export const SOCK_IMAGE = './socks.png';

// Generate paths for gifts 1 to 35
export const getGiftImage = (id: number) => `./${id}.png`;

// Configuration
export const TOTAL_SOCKS = 35;
export const DRUMROLL_DURATION = 3000; // ms

// Sound Resources
// Reverted to local paths as requested
export const SOUNDS = {
  DRUMROLL: './drum.mp3', 
  TADA: './ding.mp3',
  BGM: './bgm.mp3'
};