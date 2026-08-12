/* CELPIP progress + error-analysis patch v1 */
(function () {
  const ATTEMPTS_KEY = 'celpip_set_attempts_v1';
const MAX_ATTEMPTS = 5;

const style = document.createElement('style');
style.textContent = `
  .set-status.status-attempts {
    display: flex;
    align-items: center;
    gap: 8px;
    width: max-content;
    padding: 6px 9px;
    margin-bottom: 12px;
    background: #f6f8fc;
    color: #596579;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1;
  }

  .attempt-label {
    font-weight: 700;
    white-space: nowrap;
  }

  .set-attempt-icons {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .attempt-icon {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #d8dee9;
    display: block;
  }

  .attempt-icon.is-done {
    background: #1677ff;
  }
`;
document.head.appendChild(style);

  function loadAttempts() {
    try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveAttempts(data) {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
  }
  function getAttempts(id) {
    return Math.min(Number(loadAttempts()[id]) || 0, MAX_ATTEMPTS);
  }
  function addAttempt(id) {
    const data = loadAttempts();
    data[id] = Math.min((Number(data[id]) || 0) + 1, MAX_ATTEMPTS);
    saveAttempts(data);
  }
  function attemptIcons(count) {
    return '<span class="set-attempt-icons" aria-label="풀이 횟수 ' + count + ' / ' + MAX_ATTEMPTS + '">' +
      Array.from({ length: MAX_ATTEMPTS }, (_, i) =>
        '<span class="attempt-icon ' + (i < count ? 'is-done' : '') + '"></span>'
      ).join('') + '</span>';
  }

  const originalRenderHome = window.renderHome;
  window.renderHome = function () {
    originalRenderHome();
    document.querySelectorAll('.set-card').forEach((card, index) => {
      const setId = index + 1;
      const status = card.querySelector('.set-status');
      if (!status) return;
      const count = getAttempts(setId);
      status.classList.remove('status-empty', 'status-ready');
      status.classList.add('status-attempts');
      status.innerHTML = '<span class="attempt-label">풀이 ' + count + ' / ' + MAX_ATTEMPTS + '회</span>' + attemptIcons(count);
    });
  };

  const originalSubmitTest = window.submitTest;
  window.submitTest = function () {
    const completedSetId = window.currentSetId;
    originalSubmitTest();
    if (completedSetId) addAttempt(completedSetId);
  };

  function makeErrorAnalysisPrompt() {
    let allErrors = [];
try {
  allErrors = JSON.parse(localStorage.getItem('celpip_errors_v1')) || [];
} catch (e) {}
    if (allErrors.length === 0) return '';
    const grouped = allErrors.reduce((acc, item) => {
      const category = item.category || '기타';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    const currentSummary = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => '- ' + category + ': ' + count + '개')
      .join('\n');
    const entries = allErrors.map((item, i) =>
      '[' + (i + 1) + ']\n' +
      'category: ' + (item.category || '기타') + '\n' +
      'task: ' + (item.task || '-') + '\n' +
      'original: ' + (item.original || '-') + '\n' +
      'correction: ' + (item.correction || '-') + '\n' +
      'note: ' + (item.note || '-') + '\n' +
      'source: ' + (item.source || '-')
    ).join('\n\n');

    return `===== CELPIP Writing 오답 노트 종합 분석 요청 =====
아래는 내가 누적한 CELPIP Writing 오답 노트입니다.

현재 앱의 단순 카테고리 집계:
${currentSummary}

다음 순서와 형식으로 한국어로 분석해 주세요.
1. 가장 자주 반복되는 실수 유형 TOP 3을 빈도와 함께 제시하세요. 단, AI가 문맥을 보고 카테고리가 부정확하면 더 적절하게 재분류하세요.
2. 각 유형마다 왜 이 오류가 반복되는지, CELPIP Writing 점수에 어떤 영향을 주는지 2~3문장으로 설명하세요.
3. 각 유형마다 바로 실행할 수 있는 교정 루틴을 제안하세요: 매일 10분 연습 1개, 글 작성 전 체크 1개, 글 작성 후 체크 1개.
4. 마지막에 다음 7일 학습 계획을 Day 1~Day 7로 간단히 작성하세요.
5. 내 오답에서 실제 예문을 1개씩 인용해 ‘잘못된 표현 → 더 나은 표현’을 보여 주세요.
6. 확실하지 않은 부분은 추측이라고 표시하세요. 친절하지만 구체적으로 작성하세요.

===== 오답 데이터 시작 =====
${entries}
===== 오답 데이터 끝 =====`;
  }

  window.copyErrorAnalysisRequest = function () {
    const text = makeErrorAnalysisPrompt();
    if (!text) {
      alert('아직 저장된 오답 노트가 없습니다. 먼저 채점 결과의 @@ERROR@@ 항목을 저장하세요.');
      return;
    }
    const done = function () { alert('오답 노트 종합 분석 요청이 복사되었습니다. AI 채팅창에 붙여넣으세요.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.fallbackCopyText(text); });
    } else {
      window.fallbackCopyText(text);
    }
  };

  function addErrorAnalysisButton() {
    const view = document.getElementById('view-errors');
    if (!view || view.querySelector('#btn-error-analysis')) return;
    const firstToolbar = view.querySelector('.err-filters');
    if (!firstToolbar) return;
    const button = document.createElement('button');
    button.id = 'btn-error-analysis';
    button.className = 'btn btn-copy';
    button.type = 'button';
    button.textContent = '📋 AI 종합 분석 요청 복사';
    button.onclick = window.copyErrorAnalysisRequest;
    firstToolbar.appendChild(button);
  }

  const originalGoErrors = window.goErrors;
  window.goErrors = function () {
    originalGoErrors();
    addErrorAnalysisButton();
  };

  window.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('view-home') && typeof window.renderHome === 'function') window.renderHome();
  });
})();
