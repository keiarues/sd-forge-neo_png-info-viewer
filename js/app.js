/**
 * app.js
 * UI操作、DOMイベントリスナー、トースト通知、クリップボード連携
 */

// ==========================================
// DOM Elements
// ==========================================
const rawInput = document.getElementById('raw-input');
const outputPrompt = document.getElementById('output-prompt');
const outputNegative = document.getElementById('output-negative');
const promptBadge = document.getElementById('prompt-badge');
const negativeBadge = document.getElementById('negative-badge');
const btnCopyPrompt = document.getElementById('btn-copy-prompt');
const btnCopyNegative = document.getElementById('btn-copy-negative');
const btnManualParse = document.getElementById('btn-manual-parse');
const btnSample = document.getElementById('btn-sample');
const btnPaste = document.getElementById('btn-paste');
const btnClear = document.getElementById('btn-clear');
const inputStats = document.getElementById('input-stats');
const promptStats = document.getElementById('prompt-stats');
const negativeStats = document.getElementById('negative-stats');
const statusBar = document.getElementById('status-bar');
const statusBox = document.getElementById('status-box');
const statusIcon = document.getElementById('status-icon');
const statusText = document.getElementById('status-text');
const statusMetaTags = document.getElementById('status-meta-tags');
const extraParamsContainer = document.getElementById('extra-params-container');
const btnToggleExtra = document.getElementById('btn-toggle-extra');
const extraParamsContent = document.getElementById('extra-params-content');
const extraParamsCount = document.getElementById('extra-params-count');
const extraParamsGrid = document.getElementById('extra-params-grid');
const arrowExtra = document.getElementById('arrow-extra');

// Drag & Drop / File Elements
const dropZone = document.getElementById('drop-zone');
const dropOverlay = document.getElementById('drop-overlay');
const fileInput = document.getElementById('file-input');
const btnSelectFile = document.getElementById('btn-select-file');
const dropPrompt = document.getElementById('drop-prompt');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const previewFilename = document.getElementById('preview-filename');
const previewFilesize = document.getElementById('preview-filesize');
const previewFormat = document.getElementById('preview-format');
const btnRemoveImage = document.getElementById('btn-remove-image');

// ==========================================
// UI Helpers
// ==========================================

/**
 * 行数・文字数のカウント統計を取得
 * @param {string} text 
 * @returns {{lines: number, chars: number}}
 */
function getStats(text) {
  if (!text) return { lines: 0, chars: 0 };
  const lines = text.split(/\r\n|\r|\n/).length;
  const chars = text.length;
  return { lines, chars };
}

/**
 * HTMLエスケープ処理
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * バイト数を読みやすい形式（B / KB / MB）にフォーマット
 * @param {number} bytes 
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * トースト通知を表示
 * @param {string} message 
 * @param {'info'|'success'} type 
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');

  const isSuccess = type === 'success';
  const borderCol = isSuccess ? 'border-emerald-500/40' : 'border-indigo-500/40';
  const bgCol = isSuccess ? 'bg-emerald-950/90 text-emerald-200' : 'bg-slate-900/90 text-slate-100';

  toast.className = `flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border ${borderCol} ${bgCol} shadow-2xl backdrop-blur animate-toast-in pointer-events-auto transition-all duration-300`;
  toast.innerHTML = `
    <svg class="w-4 h-4 ${isSuccess ? 'text-emerald-400' : 'text-indigo-400'} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/**
 * クリップボードにテキストをコピー
 * @param {string} text 
 * @param {HTMLButtonElement} buttonEl 
 * @param {string} label 
 */
async function copyToClipboard(text, buttonEl, label = 'コピー') {
  if (!text || buttonEl.disabled) return;

  try {
    await navigator.clipboard.writeText(text);

    const copyTextEl = buttonEl.querySelector('.copy-text');
    const originalText = copyTextEl ? copyTextEl.textContent : label;
    if (copyTextEl) copyTextEl.textContent = 'コピー完了！';
    buttonEl.classList.add('ring-2', 'ring-emerald-400', 'bg-emerald-600/30', 'text-emerald-200', 'border-emerald-500/50');

    showToast('クリップボードにコピーしました', 'success');

    setTimeout(() => {
      if (copyTextEl) copyTextEl.textContent = originalText;
      buttonEl.classList.remove('ring-2', 'ring-emerald-400', 'bg-emerald-600/30', 'text-emerald-200', 'border-emerald-500/50');
    }, 1800);
  } catch (err) {
    console.error('Clipboard copy failed: ', err);
    const fallbackTextarea = document.createElement('textarea');
    fallbackTextarea.value = text;
    document.body.appendChild(fallbackTextarea);
    fallbackTextarea.select();
    document.execCommand('copy');
    document.body.removeChild(fallbackTextarea);
    showToast('クリップボードにコピーしました', 'success');
  }
}

// ==========================================
// Input & State Processing
// ==========================================

/**
 * 入力欄のテキストを処理し、結果をUIに反映
 */
function processInput() {
  const text = rawInput.value;
  inputStats.textContent = `${text.length} 文字`;

  const result = parseMetadata(text);

  if (result.isEmpty) {
    outputPrompt.value = '';
    outputNegative.value = '';
    btnCopyPrompt.disabled = true;
    btnCopyNegative.disabled = true;

    promptBadge.textContent = '未入力';
    promptBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono';
    promptStats.textContent = '0 行 / 0 文字';

    negativeBadge.textContent = '未入力';
    negativeBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono';
    negativeStats.textContent = '0 行 / 0 文字';

    statusBar.classList.add('hidden');
    extraParamsContainer.classList.add('hidden');
    return;
  }

  if (result.hasTemplate) {
    outputPrompt.value = result.template;
    btnCopyPrompt.disabled = false;
    promptBadge.textContent = '抽出完了';
    promptBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium';
    const st = getStats(result.template);
    promptStats.textContent = `${st.lines} 行 / ${st.chars} 文字`;
  } else {
    outputPrompt.value = '（メタデータ内にプロンプトまたは「Template:」項目が見つかりませんでした）';
    btnCopyPrompt.disabled = true;
    promptBadge.textContent = '該当なし';
    promptBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono';
    promptStats.textContent = '0 行 / 0 文字';
  }

  if (result.hasNegativeTemplate) {
    outputNegative.value = result.negativeTemplate;
    btnCopyNegative.disabled = false;
    negativeBadge.textContent = '抽出完了';
    negativeBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium';
    const st = getStats(result.negativeTemplate);
    negativeStats.textContent = `${st.lines} 行 / ${st.chars} 文字`;
  } else {
    outputNegative.value = '（メタデータ内にネガティブプロンプトまたは「Negative Template:」項目が見つかりませんでした）';
    btnCopyNegative.disabled = true;
    negativeBadge.textContent = '該当なし';
    negativeBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono';
    negativeStats.textContent = '0 行 / 0 文字';
  }

  statusBar.classList.remove('hidden');
  statusMetaTags.innerHTML = '';

  if (result.hasTemplate && result.hasNegativeTemplate) {
    statusBox.className = 'flex items-center justify-between px-4 py-2.5 rounded-xl text-sm border bg-emerald-950/30 border-emerald-800/50 text-emerald-300';
    statusIcon.innerHTML = `
      <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`;
    statusText.textContent = 'プロンプトおよびネガティブプロンプト（Template）を正常に抽出・整形しました';
  } else if (result.hasTemplate || result.hasNegativeTemplate) {
    statusBox.className = 'flex items-center justify-between px-4 py-2.5 rounded-xl text-sm border bg-blue-950/30 border-blue-800/50 text-blue-300';
    statusIcon.innerHTML = `
      <svg class="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`;
    statusText.textContent = result.hasTemplate ? 'プロンプト（Template）のみ抽出しました' : 'ネガティブプロンプト（Negative Template）のみ抽出しました';
  } else {
    statusBox.className = 'flex items-center justify-between px-4 py-2.5 rounded-xl text-sm border bg-amber-950/30 border-amber-800/50 text-amber-300';
    statusIcon.innerHTML = `
      <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>`;
    statusText.textContent = 'メタデータ項目が見つかりませんでした';
  }

  const paramKeys = Object.keys(result.extraParams);
  if (paramKeys.length > 0) {
    extraParamsContainer.classList.remove('hidden');
    extraParamsCount.textContent = paramKeys.length;
    extraParamsGrid.innerHTML = '';

    for (const [k, v] of Object.entries(result.extraParams)) {
      const item = document.createElement('div');
      item.className = 'bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 flex flex-col gap-0.5 overflow-hidden';
      item.innerHTML = `
        <span class="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">${escapeHtml(k)}</span>
        <span class="text-slate-200 font-mono truncate text-[11px]" title="${escapeHtml(v)}">${escapeHtml(v)}</span>
      `;
      extraParamsGrid.appendChild(item);
    }
  } else {
    extraParamsContainer.classList.add('hidden');
  }
}

/**
 * ファイル（画像またはテキスト）を処理
 * @param {File} file 
 */
async function handleFile(file) {
  if (!file) return;

  // 新しいファイルを読み込む前にテキストボックスおよび出力・ステータスを初期化
  rawInput.value = '';
  processInput();

  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);

  if (isImage) {
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      previewFilename.textContent = file.name;
      previewFilesize.textContent = formatBytes(file.size);
      const ext = file.name.split('.').pop() || 'IMG';
      previewFormat.textContent = ext.toUpperCase();

      dropPrompt.classList.add('hidden');
      imagePreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    try {
      const metadataText = await extractMetadataFromImage(file);
      if (metadataText && metadataText.trim()) {
        rawInput.value = metadataText;
        processInput();
        showToast(`画像（${file.name}）からメタデータを抽出しました`, 'success');
      } else {
        showToast('画像内にパラメータ情報が見つかりませんでした', 'info');
      }
    } catch (err) {
      console.error('Metadata extract error: ', err);
      showToast('画像メタデータの解析に失敗しました', 'info');
    }
  } else {
    try {
      const text = await file.text();
      rawInput.value = text;
      processInput();
      showToast(`ファイル（${file.name}）を読み込みました`, 'info');
    } catch (err) {
      console.error('Text file read error: ', err);
      showToast('ファイルの読み込みに失敗しました', 'info');
    }
  }
}

/**
 * 画像プレビュー状態をリセット
 */
function removeImagePreview() {
  imagePreview.src = '';
  imagePreviewContainer.classList.add('hidden');
  dropPrompt.classList.remove('hidden');
  fileInput.value = '';
}

// ==========================================
// Event Listeners Registration
// ==========================================

rawInput.addEventListener('input', () => {
  processInput();
});

btnManualParse.addEventListener('click', () => {
  processInput();
  showToast('解析・整形を更新しました', 'info');
});

btnCopyPrompt.addEventListener('click', () => copyToClipboard(outputPrompt.value, btnCopyPrompt, 'コピー'));
btnCopyNegative.addEventListener('click', () => copyToClipboard(outputNegative.value, btnCopyNegative, 'コピー'));

btnSample.addEventListener('click', () => {
  removeImagePreview();
  rawInput.value = SAMPLE_METADATA;
  processInput();
  showToast('テスト用サンプルデータを読み込みました', 'info');
});

btnClear.addEventListener('click', () => {
  removeImagePreview();
  rawInput.value = '';
  processInput();
  showToast('入力をクリアしました', 'info');
  rawInput.focus();
});

btnRemoveImage.addEventListener('click', (e) => {
  e.stopPropagation();
  removeImagePreview();
});

btnSelectFile.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => {
  if (e.target !== btnRemoveImage && !btnRemoveImage.contains(e.target)) {
    fileInput.click();
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

btnPaste.addEventListener('click', async () => {
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      const imageType = item.types.find(t => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const file = new File([blob], 'clipboard_image.png', { type: imageType });
        await handleFile(file);
        return;
      }
    }
    const text = await navigator.clipboard.readText();
    if (text) {
      rawInput.value = text;
      processInput();
      showToast('クリップボードから貼り付けました', 'info');
    } else {
      showToast('クリップボードが空です', 'info');
    }
  } catch (err) {
    showToast('クリップボードの読み取り権限がありません。直接貼り付けてください。', 'info');
    rawInput.focus();
  }
});

window.addEventListener('paste', async (e) => {
  if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
    const file = e.clipboardData.files[0];
    if (file.type.startsWith('image/')) {
      e.preventDefault();
      await handleFile(file);
    }
  }
});

let dragCounter = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropOverlay.classList.remove('opacity-0', 'pointer-events-none');
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropOverlay.classList.add('opacity-0', 'pointer-events-none');
  }
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.add('opacity-0', 'pointer-events-none');

  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    await handleFile(e.dataTransfer.files[0]);
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-active');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-active');
});
dropZone.addEventListener('drop', (e) => {
  dropZone.classList.remove('drag-active');
});

btnToggleExtra.addEventListener('click', () => {
  const isHidden = extraParamsContent.classList.contains('hidden');
  if (isHidden) {
    extraParamsContent.classList.remove('hidden');
    arrowExtra.classList.add('rotate-180');
  } else {
    extraParamsContent.classList.add('hidden');
    arrowExtra.classList.remove('rotate-180');
  }
});

window.addEventListener('DOMContentLoaded', () => {
  rawInput.focus();
});
