export function renderAdminDashboard(): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ASOP AI Sales System - Bảng Điều Khiển Cấu Hình</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { background-color: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #38bdf8; cursor: pointer; }
    .slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #38bdf8; cursor: pointer; }
  </style>
</head>
<body class="p-4 md:p-8 max-w-6xl mx-auto">
  <!-- Header -->
  <header class="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-slate-800 gap-4">
    <div>
      <div class="flex items-center gap-3">
        <span class="text-3xl">🚀</span>
        <h1 class="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          ASOP AI Sales - Trung Tâm Cấu Hình & Giám Sát
        </h1>
      </div>
      <p class="text-slate-400 text-sm mt-1">Hệ thống Middleware điều phối AI tư vấn bán béc tưới tự động 24/7</p>
    </div>
    <div class="flex items-center gap-2">
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        Hệ thống đang chạy
      </span>
      <button onclick="loadAll()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition flex items-center gap-1.5 border border-slate-700">
        <i class="fa-solid fa-rotate"></i> Làm mới
      </button>
    </div>
  </header>

  <!-- Quick Presets -->
  <div class="mb-8">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
      <i class="fa-solid fa-bolt text-amber-400"></i> Cấu hình nhanh (Presets)
    </h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <button onclick="applyPreset('fast')" class="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/60 transition text-left group">
        <div class="flex items-center justify-between mb-1">
          <span class="font-bold text-cyan-400 text-base">⚡ Siêu Tốc (Fast Mode)</span>
          <span class="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">2.5 giây</span>
        </div>
        <p class="text-xs text-slate-400">Chờ 2.5s gom tin, phản hồi cực nhanh khi khách ngừng gõ. Thích hợp khách thích câu trả lời liền tay.</p>
      </button>

      <button onclick="applyPreset('balanced')" class="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/60 transition text-left group">
        <div class="flex items-center justify-between mb-1">
          <span class="font-bold text-emerald-400 text-base">⚖️ Cân Bằng (Khuyên dùng)</span>
          <span class="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">3.5 giây</span>
        </div>
        <p class="text-xs text-slate-400">Chờ 3.5s cơ bản, trần 15s. Tự nhiên như người thật, gom đủ ý trước khi AI tư vấn.</p>
      </button>

      <button onclick="applyPreset('standard')" class="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 transition text-left group">
        <div class="flex items-center justify-between mb-1">
          <span class="font-bold text-indigo-400 text-base">🛡️ Gom Chậm (Patient)</span>
          <span class="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono">6.0 giây</span>
        </div>
        <p class="text-xs text-slate-400">Chờ 6.0s gom tin dài. Thích hợp khách hay gõ lắt nhắt từng từ một.</p>
      </button>
    </div>
  </div>

  <!-- Form Configuration -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
    <div class="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-sliders text-cyan-400"></i> Điều chỉnh thời gian Rolling Debounce & Bong bóng chat
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">Thay đổi có hiệu lực ngay lập tức trong Redis, không cần khởi động lại máy chủ</p>
        </div>
      </div>

      <form id="configForm" onsubmit="saveConfig(event)" class="space-y-6">
        <!-- Base Delay -->
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <label class="text-sm font-semibold text-slate-200">
              Thời gian chờ cơ bản (Base Delay)
              <span class="text-xs font-normal text-slate-400 block">Thời gian đếm ngược sau mỗi tin nhắn của khách trước khi gửi AI</span>
            </label>
            <span id="baseVal" class="text-sm font-bold text-cyan-400 font-mono px-2 py-0.5 bg-slate-800 rounded">3000 ms</span>
          </div>
          <input type="range" id="debounceBaseMs" min="1000" max="10000" step="500" class="slider w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" oninput="updateLabel('baseVal', this.value)">
          <div class="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>Nhanh (1.0s)</span>
            <span>Mặc định (3.0s)</span>
            <span>Chậm (10.0s)</span>
          </div>
        </div>

        <!-- Extend Delay -->
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <label class="text-sm font-semibold text-slate-200">
              Thời gian chờ gia hạn (Extend Delay)
              <span class="text-xs font-normal text-slate-400 block">Chờ thêm khi khách mới nhắn câu mào đầu cụt (VD: "alo", "shop ơi") hoặc mới gửi ảnh</span>
            </label>
            <span id="extendVal" class="text-sm font-bold text-cyan-400 font-mono px-2 py-0.5 bg-slate-800 rounded">4000 ms</span>
          </div>
          <input type="range" id="debounceExtendMs" min="1000" max="15000" step="500" class="slider w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" oninput="updateLabel('extendVal', this.value)">
          <div class="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>1.0s</span>
            <span>4.0s</span>
            <span>15.0s</span>
          </div>
        </div>

        <!-- Max Wait -->
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <label class="text-sm font-semibold text-slate-200">
              Trần chờ tối đa (Max Wait Cap)
              <span class="text-xs font-normal text-slate-400 block">Giới hạn thời gian tối đa bắt buộc phải trả lời, dù khách vẫn đang gõ tiếp</span>
            </label>
            <span id="maxVal" class="text-sm font-bold text-cyan-400 font-mono px-2 py-0.5 bg-slate-800 rounded">15000 ms</span>
          </div>
          <input type="range" id="debounceMaxWaitMs" min="5000" max="40000" step="1000" class="slider w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" oninput="updateLabel('maxVal', this.value)">
          <div class="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>5.0s</span>
            <span>15.0s</span>
            <span>40.0s</span>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Min Bubble Delay -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs font-semibold text-slate-300">Độ trễ tối thiểu giữa các câu</label>
              <span id="minBubbleVal" class="text-xs font-mono text-cyan-400">800 ms</span>
            </div>
            <input type="range" id="minBubbleDelayMs" min="300" max="2500" step="100" class="slider w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" oninput="updateLabel('minBubbleVal', this.value)">
          </div>

          <!-- Max Bubble Delay -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs font-semibold text-slate-300">Độ trễ tối đa giữa các câu</label>
              <span id="maxBubbleVal" class="text-xs font-mono text-cyan-400">2000 ms</span>
            </div>
            <input type="range" id="maxBubbleDelayMs" min="800" max="4000" step="100" class="slider w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" oninput="updateLabel('maxBubbleVal', this.value)">
          </div>
        </div>

        <div class="flex items-center justify-between pt-4">
          <span id="saveStatus" class="text-xs text-emerald-400 font-medium hidden flex items-center gap-1.5">
            <i class="fa-solid fa-circle-check"></i> Đã lưu cấu hình thành công!
          </span>
          <button type="submit" class="ml-auto px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center gap-2">
            <i class="fa-solid fa-floppy-disk"></i> Lưu Cấu Hình Ngay
          </button>
        </div>
      </form>
    </div>

    <!-- System Status Column -->
    <div class="space-y-4">
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <i class="fa-solid fa-heart-pulse text-rose-400"></i> Trạng thái dịch vụ
        </h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50">
            <span class="text-xs font-medium text-slate-300 flex items-center gap-2">
              <i class="fa-solid fa-microchip text-indigo-400"></i> Redis Queue (BullMQ)
            </span>
            <span class="text-xs font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">Hoạt động</span>
          </div>

          <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50">
            <span class="text-xs font-medium text-slate-300 flex items-center gap-2">
              <i class="fa-solid fa-brain text-amber-400"></i> Dify Chatflow AI
            </span>
            <span class="text-xs font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">Sẵn sàng</span>
          </div>

          <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50">
            <span class="text-xs font-medium text-slate-300 flex items-center gap-2">
              <i class="fa-solid fa-database text-emerald-400"></i> Supabase Database
            </span>
            <span class="text-xs font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">Đã kết nối</span>
          </div>

          <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50">
            <span class="text-xs font-medium text-slate-300 flex items-center gap-2">
              <i class="fa-brands fa-telegram text-sky-400"></i> Telegram Bot Alert
            </span>
            <span class="text-xs font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">Trực 24/7</span>
          </div>
        </div>
      </div>

      <!-- Quick Test & Tools -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <i class="fa-solid fa-wrench text-cyan-400"></i> Thao tác nhanh
        </h3>
        <p class="text-xs text-slate-400 mb-3">Bật lại AI ngay lập tức cho tài khoản đang test nếu bị khóa:</p>
        <button onclick="resetTestingUser()" class="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-800/50 transition flex items-center justify-center gap-2">
          <i class="fa-solid fa-toggle-on"></i> Mở lại AI cho nick Tâm Trần
        </button>
      </div>
    </div>
  </div>

  <!-- Recent Conversations Table -->
  <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl mb-12">
    <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
      <h2 class="text-lg font-bold text-white flex items-center gap-2">
        <i class="fa-solid fa-comments text-cyan-400"></i> Quản lý trạng thái AI theo Khách Hàng
      </h2>
      <span class="text-xs text-slate-400">Có thể bật/tắt AI thủ công trực tiếp cho từng khách</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-semibold">
          <tr>
            <th class="p-3 rounded-l-lg">Khách hàng</th>
            <th class="p-3">PSID</th>
            <th class="p-3">SĐT chốt đơn</th>
            <th class="p-3">Trạng thái AI</th>
            <th class="p-3">Lý do bàn giao</th>
            <th class="p-3">Cập nhật</th>
            <th class="p-3 rounded-r-lg text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody id="convTableBody" class="divide-y divide-slate-800/50 text-slate-300">
          <tr>
            <td colspan="7" class="p-4 text-center text-slate-500">Đang tải danh sách...</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    function updateLabel(id, val) {
      document.getElementById(id).innerText = val + ' ms';
    }

    const PRESETS = {
      fast: { debounceBaseMs: 2500, debounceExtendMs: 3000, debounceMaxWaitMs: 10000, minBubbleDelayMs: 600, maxBubbleDelayMs: 1500 },
      balanced: { debounceBaseMs: 3500, debounceExtendMs: 4000, debounceMaxWaitMs: 15000, minBubbleDelayMs: 800, maxBubbleDelayMs: 2000 },
      standard: { debounceBaseMs: 6000, debounceExtendMs: 7000, debounceMaxWaitMs: 25000, minBubbleDelayMs: 1000, maxBubbleDelayMs: 2500 }
    };

    function applyPreset(name) {
      const p = PRESETS[name];
      if (!p) return;
      document.getElementById('debounceBaseMs').value = p.debounceBaseMs;
      document.getElementById('debounceExtendMs').value = p.debounceExtendMs;
      document.getElementById('debounceMaxWaitMs').value = p.debounceMaxWaitMs;
      document.getElementById('minBubbleDelayMs').value = p.minBubbleDelayMs;
      document.getElementById('maxBubbleDelayMs').value = p.maxBubbleDelayMs;

      updateLabel('baseVal', p.debounceBaseMs);
      updateLabel('extendVal', p.debounceExtendMs);
      updateLabel('maxVal', p.debounceMaxWaitMs);
      updateLabel('minBubbleVal', p.minBubbleDelayMs);
      updateLabel('maxBubbleVal', p.maxBubbleDelayMs);

      // Auto save
      saveConfig();
    }

    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        document.getElementById('debounceBaseMs').value = data.debounceBaseMs;
        document.getElementById('debounceExtendMs').value = data.debounceExtendMs;
        document.getElementById('debounceMaxWaitMs').value = data.debounceMaxWaitMs;
        document.getElementById('minBubbleDelayMs').value = data.minBubbleDelayMs;
        document.getElementById('maxBubbleDelayMs').value = data.maxBubbleDelayMs;

        updateLabel('baseVal', data.debounceBaseMs);
        updateLabel('extendVal', data.debounceExtendMs);
        updateLabel('maxVal', data.debounceMaxWaitMs);
        updateLabel('minBubbleVal', data.minBubbleDelayMs);
        updateLabel('maxBubbleVal', data.maxBubbleDelayMs);
      } catch (err) {
        console.error('Load config error:', err);
      }
    }

    async function saveConfig(e) {
      if (e) e.preventDefault();
      const payload = {
        debounceBaseMs: Number(document.getElementById('debounceBaseMs').value),
        debounceExtendMs: Number(document.getElementById('debounceExtendMs').value),
        debounceMaxWaitMs: Number(document.getElementById('debounceMaxWaitMs').value),
        minBubbleDelayMs: Number(document.getElementById('minBubbleDelayMs').value),
        maxBubbleDelayMs: Number(document.getElementById('maxBubbleDelayMs').value),
      };

      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          const status = document.getElementById('saveStatus');
          status.classList.remove('hidden');
          setTimeout(() => status.classList.add('hidden'), 3000);
        }
      } catch (err) {
        alert('Lưu cấu hình thất bại: ' + err.message);
      }
    }

    async function loadConversations() {
      try {
        const res = await fetch('/api/conversations');
        const list = await res.json();
        const tbody = document.getElementById('convTableBody');
        if (!list || list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-500">Chưa có hội thoại nào</td></tr>';
          return;
        }

        tbody.innerHTML = list.map(c => {
          const isAiOn = c.ai_enabled !== false;
          const statusBadge = isAiOn
            ? '<span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800">🟢 Đang BẬT</span>'
            : '<span class="px-2 py-0.5 rounded bg-rose-950 text-rose-400 font-semibold border border-rose-800">🔴 Đã TẮT</span>';

          const actionBtn = isAiOn
            ? \`<button onclick="toggleAi('\${c.page_id}', '\${c.psid}', false)" class="px-2.5 py-1 bg-slate-800 hover:bg-rose-900/50 text-rose-400 rounded border border-rose-800/50 transition text-[11px]">Tắt AI</button>\`
            : \`<button onclick="toggleAi('\${c.page_id}', '\${c.psid}', true)" class="px-2.5 py-1 bg-slate-800 hover:bg-emerald-900/50 text-emerald-400 rounded border border-emerald-800/50 transition text-[11px]">Bật lại AI</button>\`;

          const dateStr = c.updated_at ? new Date(c.updated_at).toLocaleTimeString('vi-VN') : '-';

          return \`<tr class="hover:bg-slate-800/30 transition">
            <td class="p-3 font-semibold text-white">\${c.customer_name || 'Khách Facebook'}</td>
            <td class="p-3 font-mono text-slate-400">\${c.psid}</td>
            <td class="p-3 font-mono text-cyan-400 font-semibold">\${c.phone_number || '-'}</td>
            <td class="p-3">\${statusBadge}</td>
            <td class="p-3 text-slate-400 text-[11px]">\${c.handover_reason || '-'}</td>
            <td class="p-3 text-slate-400">\${dateStr}</td>
            <td class="p-3 text-right">\${actionBtn}</td>
          </tr>\`;
        }).join('');
      } catch (err) {
        console.error('Load conv error:', err);
      }
    }

    async function toggleAi(pageId, psid, enable) {
      try {
        await fetch('/api/conversations/toggle-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId, psid, enable })
        });
        loadConversations();
      } catch (err) {
        alert('Lỗi thao tác: ' + err.message);
      }
    }

    async function resetTestingUser() {
      await toggleAi('110283804756679', '28277783578561278', true);
      alert('Đã mở lại AI cho nick Tâm Trần!');
    }

    function loadAll() {
      loadConfig();
      loadConversations();
    }

    loadAll();
    setInterval(loadConversations, 10000);
  </script>
</body>
</html>
`;
}
