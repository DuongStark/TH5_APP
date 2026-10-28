import { timeText } from './core.mjs';

function fitPhone() {
  const embedded = new URLSearchParams(location.search).get('embed') === '1';
  document.body.classList.toggle('embedded', embedded);
  const margin = embedded ? 0 : 32;
  const scale = Math.min(
    1,
    (innerWidth - margin) / 414,
    (innerHeight - margin) / 894,
  );
  document.documentElement.style.setProperty(
    '--phone-scale',
    Math.max(0.1, scale),
  );
}
function updateClock() {
  document.getElementById('clock').textContent = timeText(Date.now()).replace(
    /^0/,
    '',
  );
}
fitPhone();
updateClock();
window.addEventListener('resize', fitPhone);
setInterval(updateClock, 30000);

// Hiện lỗi rõ ràng nếu mạng không tải được Firebase SDK.
try {
  await import('./app.mjs');
} catch (error) {
  document.getElementById('loading-screen').hidden = true;
  document.getElementById('auth-screen').hidden = false;
  const notice = document.getElementById('global-error');
  notice.textContent =
    'Không tải được Firebase. Kiểm tra kết nối Internet rồi tải lại trang.';
  notice.hidden = false;
  document.getElementById('auth-submit').disabled = true;
  console.error(error);
}
