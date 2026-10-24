(function () {
  "use strict";
  let cancel = null;
  const labels = {
    en: {
      title: "AI career workspace", sample: "Sample workspace: paid AI requests are disabled. Explore the sample report instead.",
      guest: "Sign in and save your target role before using personal AI features.",
      login: "Sign in", choose: "Choose a feature", plan: "Learning plan advice", tutor: "Learning assistant",
      interview: "Text interview coach", request: "Your question or request", submit: "Generate",
      cancel: "Stop waiting", ready: "Ready. Each submission may use DeepSeek API quota.",
      pending: "Connecting to DeepSeek / generating… The first request may take longer.",
      failure: "Request failed. You can retry manually.", disclaimer: "AI suggestions, not verified assessment evidence. Your existing plan and skill scores are not changed. Only the saved role, weekly hours, skill names and self-reported levels are sent with your question. Do not include confidential information.",
      report: "Career report", disabled: "DeepSeek or the account database is not configured. Existing non-AI features remain available.",
      stopped: "Stopped waiting. The server may still finish and use API quota; avoid immediately resubmitting.",
      transient: "Temporary conversation: remembers up to 4 recent messages in this page. Switching feature, leaving or refreshing clears it. Not saved as report history.",
      network: "Unable to check AI availability. Refresh or try again later."
    },
    zh: {
      title: "AI 职业工作台", sample: "示例空间不调用付费 AI，请使用静态示例报告。",
      guest: "请先登录并保存目标岗位，再使用个人 AI 功能。",
      login: "登录", choose: "请选择功能", plan: "学习计划建议", tutor: "学习助手",
      interview: "文字模拟面试", request: "你的问题或请求", submit: "生成",
      cancel: "停止等待", ready: "准备就绪，每次提交会计入 DeepSeek API 用量。",
      pending: "正在连接 DeepSeek／生成中……首次请求可能需要更长时间。",
      failure: "请求失败，可手动重试。", disclaimer: "AI 建议不是已验证的测评证据，不会修改原学习计划或技能分数。只会将已保存的目标岗位、每周时间、技能名称及自报水平连同本次问题发送给模型，请勿输入机密资料。",
      report: "职业报告", disabled: "DeepSeek 或账户数据库尚未配置，原有非 AI 功能仍可使用。",
      stopped: "已停止等待。服务器可能仍会完成生成并计入 API 用量，请勿立即重复提交。",
      transient: "本页临时保留最近 4 条对话。切换功能、离开或刷新将清空，不会保存为报告历史。",
      network: "无法确认 AI 服务状态，请刷新或稍后重试。"
    }
  };
  function locale(options) { return labels[options.language === "zh" ? "zh" : "en"]; }
  window.CBAssistant = {
    invalidate() { if (cancel) cancel(); cancel = null; },
    render(options) {
      const t = locale(options);
      const unavailable = options.demo || !options.userId;
      return '<article id="ai-workspace" class="panel" data-i18n-skip><div class="panel-heading"><h2>' + t.title + '</h2></div><p>' + t.disclaimer + '</p>' +
        (unavailable ? '<p role="status">' + (options.demo ? t.sample : t.guest) + '</p>' + (!options.demo ? '<button class="button button-primary" id="ai-login">' + t.login + '</button>' : '<a class="button button-primary" href="/?view=report&amp;sample=1">' + t.report + '</a>') :
          '<form id="ai-assistant-form"><div class="field"><label for="ai-task">' + t.choose + '</label><select id="ai-task" name="task" required><option value="">' + t.choose + '</option><option value="plan">' + t.plan + '</option><option value="tutor">' + t.tutor + '</option><option value="interview">' + t.interview + '</option></select></div><div class="field"><label for="ai-question">' + t.request + '</label><textarea id="ai-question" name="question" maxlength="2500" rows="5" required></textarea></div><p>' + t.transient + '</p><div class="modal-actions"><button class="button button-primary" id="ai-submit" disabled>' + t.submit + '</button><button class="button button-quiet" type="button" id="ai-stop" hidden>' + t.cancel + '</button></div></form><p id="ai-status" role="status" aria-live="polite"></p><pre id="ai-result" style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit"></pre><button class="button button-quiet" data-nav="signals">' + t.report + '</button>') + '</article>';
    },
    mount(root, options) {
      const t = locale(options);
      const login = root.querySelector("#ai-login");
      if (login) login.addEventListener("click", options.onLogin);
      const form = root.querySelector("#ai-assistant-form");
      if (!form) return; // No status/API requests in sample or guest mode.
      let alive = true;
      let controller;
      let history = [];
      cancel = function () { alive = false; if (controller) controller.abort(); };
      const status = root.querySelector("#ai-status");
      const result = root.querySelector("#ai-result");
      const submit = root.querySelector("#ai-submit");
      const stop = root.querySelector("#ai-stop");
      fetch("/api/ai/status", { credentials: "same-origin" }).then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!alive) return;
        submit.disabled = !(data.configured && data.accountsConfigured);
        status.textContent = submit.disabled ? t.disabled : t.ready;
      }).catch(() => { if (alive) status.textContent = t.network; });
      stop.addEventListener("click", () => { if (controller) controller.abort(); });
      form.elements.task.addEventListener("change", () => {
        history = [];
        result.textContent = "";
      });
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (submit.disabled || !form.reportValidity()) return;
        controller = new AbortController();
        const task = form.elements.task.value;
        const question = form.elements.question.value;
        const timer = setTimeout(() => controller.abort(), 130000);
        submit.disabled = true;
        form.elements.task.disabled = true;
        stop.hidden = false;
        status.textContent = t.pending;
        result.textContent = "";
        try {
          const response = await fetch("/api/ai/assist", {
            method: "POST", credentials: "same-origin",
            headers: { "Content-Type": "application/json" }, signal: controller.signal,
            body: JSON.stringify({
              workspace: "user_owned", expectedAccountId: options.userId,
              task: task, question: question, history: history,
              language: options.language
            })
          });
          const data = await response.json();
          if (!alive) return;
          if (!response.ok || typeof data.text !== "string") throw new Error(data.error || t.failure);
          history = history.concat([
            { role: "user", content: question.slice(0, 1200) },
            { role: "assistant", content: data.text.slice(0, 1200) }
          ]).slice(-4);
          result.textContent = data.text;
          status.textContent = t.transient;
        } catch (error) {
          if (alive) status.textContent = error.name === "AbortError" ? t.stopped : error.message || t.failure;
        } finally {
          clearTimeout(timer);
          if (alive) { submit.disabled = false; form.elements.task.disabled = false; stop.hidden = true; }
        }
      });
    }
  };
})();
