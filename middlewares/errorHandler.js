export function errorHandler(err, req, res, next) {
  console.error(err.stack);
<<<<<<< HEAD
  const status = err.message.includes("ไม่พบ") ? 404 : 
                err.message.includes("กรุณาระบุ") ? 400 : 500;
  res.status(status).json({ 
    error: err.message || 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่ภายหลัง' 
  });
}
=======
  res.status(500).json({ error: 'Internal Server Error' });
} 
>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41
