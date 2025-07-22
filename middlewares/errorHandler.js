export function errorHandler(err, req, res, next) {
  console.error(err.stack);
  const status = err.message.includes("ไม่พบ") ? 404 : 
                err.message.includes("กรุณาระบุ") ? 400 : 500;
  res.status(status).json({ 
    error: err.message || 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่ภายหลัง' 
  });
}
