// กติการูปบิล (ใช้ร่วมกันหลาย store — แยกไฟล์กัน import วนกัน)
export const MAX_IMAGES = 3;
export const MAX_FILE_MB = 15; // ตรงกับ limit ฝั่ง BE
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
