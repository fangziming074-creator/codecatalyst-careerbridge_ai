(function () {
  "use strict";
  // Hand-authored educational fixture. Never presented as a live search or forecast.
  window.CBSampleReport = function (language) {
    const pick = (zh, en) => language === "en" ? en : zh;
    return {
      report: {
        title: pick("数据分析师职业探索 · 示例报告", "Data analyst career exploration · Sample report"),
        subtitle: pick("人工编写的流程示例，不是本次联网检索结果，不代表当前招聘或你的个人职业结论。", "A hand-authored workflow example, not a live search, a current hiring assessment, or a personal career conclusion."),
        summary: pick("示例目标是从业务分析转向数据分析。先用 SQL、数据清理和图表说明完成一个可复核的小项目，再核对当地岗位要求。这里不计算录用概率。", "This example explores a move from business analysis to data analytics. Start with a reviewable project using SQL, data cleaning, and chart explanations, then check local job requirements. No hiring probability is calculated."),
        currentMarket: pick("本示例没有检索当前职位数量、工资或发布日期。真实报告需要分别核对地区、岗位级别与来源口径。", "This example has not searched current vacancy counts, salaries, or posting dates. A live report must verify the region, seniority, and source definitions."),
        aiImpact: pick("WEF 的全球报告讨论了 AI、大数据与分析思维等技能方向，但不能直接预测个人岗位风险。[S01] 可通过一个 AI 辅助任务比较效率、错误与核验成本。", "The WEF global report discusses AI, big data, and analytical thinking, but does not predict an individual's job risk.[S01] Compare efficiency, errors, and verification effort on one AI-assisted task."),
        capitalImpact: pick("证据空白：本示例没有检索当地资本投入。不能据此推断岗位正在增加。", "Evidence gap: this example has not searched local investment. It cannot establish that jobs are increasing."),
        policyImpact: pick("证据空白：本示例没有核对当地最新法规。使用外部工具前应另行核实授权、隐私与数据处理要求。", "Evidence gap: this example has not checked current local regulations. Verify authorization, privacy, and data-handling requirements before using external tools."),
        outlook: pick("这是学习探索流程，不是就业预测。下一步应结合真实岗位样本、个人约束和实践反馈重新判断。", "This is a learning-exploration workflow, not an employment forecast. Reassess using real job samples, personal constraints, and practical feedback."),
        scenarios: [{
          name: pick("条件示例：工具普及加快", "Illustrative condition: faster tool adoption"),
          conditions: pick("假设团队开始使用 AI 辅助生成基础报告；不是已发生事实。", "Assume a team starts using AI to draft routine reports; this is not an observed fact."),
          impact: pick("可能减少部分整理时间，但业务定义、数据核验和责任仍需明确。", "Some preparation time may fall, while business definitions, verification, and accountability still need attention."),
          indicators: pick("比较同类任务耗时、错误率、复核成本和同事反馈。", "Compare time, error rates, review effort, and colleague feedback on comparable tasks.")
        }],
        careerActions: [
          pick("选择一个公开或已获授权的数据集，记录问题、清洗步骤和限制。", "Choose public or authorized data and document the question, cleaning steps, and limitations."),
          pick("用 SQL 回答三个问题，保存查询与可复核结果。", "Answer three questions with SQL and keep the queries and reviewable results."),
          pick("用一张图解释结论，邀请他人检查口径与推断。", "Explain a conclusion with one chart and ask someone to check definitions and reasoning.")
        ],
        watchlist: [
          pick("当地近期岗位的技能要求与薪资披露口径。", "Skill requirements and salary definitions in recent local job postings."),
          pick("作品质量、独立完成程度与任务反馈，而不只记录学习时长。", "Work quality, independence, and task feedback, rather than learning hours alone.")
        ],
        evidenceGaps: [pick("未检索实时就业、资本和政策资料；不包含公司在招信息。", "No live employment, investment, or policy search; no current company vacancies.")]
      },
      sources: [{
        id: "S01", title: "WEF · The Future of Jobs Report 2025",
        url: "https://www.weforum.org/publications/the-future-of-jobs-report-2025/",
        siteName: "World Economic Forum",
        summary: pick("供阅读方法与全球背景参考；不是本次实时检索或当地职位证据。", "For reading methods and global context, not a live search or evidence of local vacancies.")
      }],
      meta: { coverage: [pick("静态教学示例", "Static educational example")] }
    };
  };
})();
